// `patties run <task>` — task runner + content-addressed output cache for
// Bun-workspace monorepos (framework/27-task-runner-cache). Wraps each
// (package, task) unit with the cache layer, in topological order. Bare
// `patties build` / `dev` are unchanged; `run` is the opt-in CI orchestrator.

import { join } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { loadConfig } from "../config/load.ts";
import type { TasksConfig } from "../config/schema.ts";
import type { CliContext } from "./index.ts";
import { EXIT, log } from "./log.ts";
import { type Affected, computeAffected } from "./run/affected.ts";
import { type KeyGlobals, sha256Hex } from "./run/cache-key.ts";
import { CacheStore } from "./run/cache-store.ts";
import { collectRepoFileHashes } from "./run/files.ts";
import { runTasks } from "./run/runner.ts";
import { discoverWorkspace, type Workspace } from "./run/workspace.ts";

const FRAMEWORK_VERSION = (pkg as { version: string }).version;

export interface RunArgs {
	taskName?: string;
	filter?: string;
	affected: boolean;
	since?: string;
	noCache: boolean;
	force: boolean;
	dryRun: boolean;
	concurrency?: number;
	remote: boolean;
}

export async function runRun(
	argv: string[],
	ctx: CliContext = { cwd: process.cwd(), verbose: false },
): Promise<number> {
	const args = parseArgs(argv);

	if (!args.taskName) {
		log.error("patties run: missing <task> (e.g. `patties run build`).");
		return EXIT.USAGE;
	}
	if (args.remote) {
		log.error(
			"patties run: --remote (remote cache) is not yet implemented — it ships in Phase 2.",
		);
		return EXIT.USAGE;
	}

	let ws: Workspace;
	try {
		ws = await discoverWorkspace(ctx.cwd);
	} catch (err) {
		log.error((err as Error)?.message ?? String(err));
		return EXIT.ERROR;
	}

	// The root config carries the `tasks` block; treat its absence as "defaults".
	let tasksConfig: TasksConfig | undefined;
	let rootConfigPath: string | undefined;
	try {
		const loaded = await loadConfig({
			cwd: ctx.cwd,
			configPath: ctx.configPath,
		});
		tasksConfig = loaded.config.tasks;
		rootConfigPath = loaded.path ?? undefined;
	} catch {
		log.debug("patties run: no root patties.config — using task defaults.");
	}

	const selected = await select(ws, args);
	if (selected !== "all" && selected.size === 0) {
		log.info(`patties run ${args.taskName}: nothing selected.`);
		return EXIT.OK;
	}

	const globals: KeyGlobals = {
		root: ws.root,
		fileHashes: await collectRepoFileHashes(ws.root),
		rootConfigHash: await hashFileIfExists(rootConfigPath),
		rootTsconfigHash: await hashFileIfExists(join(ws.root, "tsconfig.json")),
		bunLockHash: await hashLock(ws.root),
		pattiesVersion: FRAMEWORK_VERSION,
		env: process.env,
	};

	const store = await CacheStore.open(join(ws.root, ".patties", "cache"));
	try {
		const summary = await runTasks({
			ws,
			taskName: args.taskName,
			selected,
			globals,
			tasksConfig,
			store,
			flags: {
				force: args.force,
				noCache: args.noCache,
				dryRun: args.dryRun,
			},
		});

		if (!args.dryRun)
			log.success(
				`run ${args.taskName}: ${summary.hits} cached, ${summary.ran} ran`,
			);
		return summary.exitCode === 0 ? EXIT.OK : EXIT.ERROR;
	} finally {
		store.close();
	}
}

async function select(ws: Workspace, args: RunArgs): Promise<Affected> {
	let selected: Affected = "all";
	if (args.affected)
		selected = await computeAffected(ws, { since: args.since });
	if (args.filter) {
		const filtered = matchFilter(ws, args.filter);
		selected = selected === "all" ? filtered : intersect(selected, filtered);
	}
	return selected;
}

function matchFilter(ws: Workspace, pattern: string): Set<string> {
	const glob = new Bun.Glob(pattern);
	const out = new Set<string>();
	for (const pkgNode of ws.packages.values())
		if (
			pkgNode.name === pattern ||
			glob.match(pkgNode.name) ||
			glob.match(pkgNode.relDir)
		)
			out.add(pkgNode.name);
	return out;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
	const out = new Set<string>();
	for (const x of a) if (b.has(x)) out.add(x);
	return out;
}

async function hashFileIfExists(path: string | undefined): Promise<string> {
	if (!path) return "";
	const file = Bun.file(path);
	return (await file.exists()) ? sha256Hex(await file.bytes()) : "";
}

async function hashLock(root: string): Promise<string> {
	for (const name of ["bun.lock", "bun.lockb"]) {
		const hash = await hashFileIfExists(join(root, name));
		if (hash !== "") return hash;
	}
	return "";
}

function parseArgs(argv: string[]): RunArgs {
	const out: RunArgs = {
		affected: false,
		noCache: false,
		force: false,
		dryRun: false,
		remote: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--filter") out.filter = String(argv[++i]);
		else if (a.startsWith("--filter=")) out.filter = a.slice(9);
		else if (a === "--since") out.since = String(argv[++i]);
		else if (a.startsWith("--since=")) out.since = a.slice(8);
		else if (a === "--affected") out.affected = true;
		else if (a === "--no-cache") out.noCache = true;
		else if (a === "--force") out.force = true;
		else if (a === "--dry-run") out.dryRun = true;
		else if (a === "--remote") out.remote = true;
		else if (a === "--concurrency") out.concurrency = Number(argv[++i]);
		else if (a.startsWith("--concurrency="))
			out.concurrency = Number(a.slice(14));
		else if (!a.startsWith("-") && out.taskName === undefined) out.taskName = a;
	}
	return out;
}
