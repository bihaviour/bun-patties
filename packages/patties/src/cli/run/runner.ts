// Per-task execution loop for `patties run` (framework/27-task-runner-cache).
// Walks the workspace in topological order so every package's cache key is
// computed before its dependents need it (the `internalDepKeys` term). Keys are
// computed for ALL task-defining packages — even ones a `--filter`/`--affected`
// selection excludes from execution — because a selected dependent still folds
// an unselected dependency's key into its own.

import type { TasksConfig } from "../../config/schema.ts";
import { log } from "../log.ts";
import type { Affected } from "./affected.ts";
import {
	computeKey,
	firstDifferingComponent,
	type KeyComponents,
	type KeyGlobals,
} from "./cache-key.ts";
import type { CacheStore } from "./cache-store.ts";
import type { Workspace } from "./workspace.ts";

export interface RunFlags {
	force: boolean;
	noCache: boolean;
	dryRun: boolean;
}

export interface RunTasksInput {
	ws: Workspace;
	taskName: string;
	selected: Affected;
	globals: KeyGlobals;
	tasksConfig: TasksConfig | undefined;
	store: CacheStore;
	flags: RunFlags;
}

export interface RunSummary {
	hits: number;
	ran: number;
	skipped: number;
	exitCode: number;
}

export async function runTasks(input: RunTasksInput): Promise<RunSummary> {
	const { ws, taskName, selected, globals, tasksConfig, store, flags } = input;
	const taskCfg = tasksConfig?.[taskName];
	const computedKeys = new Map<string, string>();
	const summary: RunSummary = { hits: 0, ran: 0, skipped: 0, exitCode: 0 };

	let anyDefined = false;
	for (const name of ws.topoOrder) {
		const pkg = ws.packages.get(name);
		if (!pkg) continue;
		const command = pkg.scripts[taskName];
		if (!command) continue; // package doesn't define <task>
		anyDefined = true;

		const internalDepKeys: Record<string, string> = {};
		for (const dep of pkg.internalDeps) {
			const depKey = computedKeys.get(dep);
			if (depKey) internalDepKeys[dep] = depKey;
		}

		const { key, components } = await computeKey({
			pkg,
			taskName,
			command,
			task: taskCfg,
			globals,
			internalDepKeys,
		});
		computedKeys.set(name, key);

		if (selected !== "all" && !selected.has(name)) continue;

		const cacheEnabled = taskCfg?.cache !== false && !flags.noCache;

		if (flags.dryRun) {
			reportDryRun(store, name, taskName, key, components, cacheEnabled);
			continue;
		}

		if (cacheEnabled && !flags.force && store.has(key)) {
			log.success(`${name} ${taskName}  ${dim("cache hit")}`);
			await store.restore(key, pkg.dir);
			await store.replayLog(key);
			store.recordRun({ key, components, packageName: name, taskName });
			summary.hits++;
			continue;
		}

		log.info(`▶ ${name} ${taskName}`);
		const { exitCode, output } = await spawnCapture(taskName, pkg.dir);
		summary.ran++;

		if (exitCode !== 0) {
			log.error(`${name} ${taskName} failed (exit ${exitCode})`);
			summary.exitCode = exitCode;
			return summary;
		}

		if (cacheEnabled) {
			await store.put({
				key,
				pkgDir: pkg.dir,
				outputs: taskCfg?.outputs ?? [],
				log: output,
				exitCode,
				components,
				packageName: name,
				taskName,
			});
		} else {
			store.recordRun({ key, components, packageName: name, taskName });
		}
	}

	if (!anyDefined)
		log.warn(`no workspace package defines a "${taskName}" script.`);
	return summary;
}

function reportDryRun(
	store: CacheStore,
	name: string,
	taskName: string,
	key: string,
	components: KeyComponents,
	cacheEnabled: boolean,
): void {
	if (!cacheEnabled) {
		log.info(`${name} ${taskName}  ${dim("MISS (cache disabled)")}`);
		return;
	}
	if (store.has(key)) {
		log.info(`${name} ${taskName}  ${dim("HIT")}`);
		return;
	}
	const last = store.lastRun(name, taskName);
	if (!last) {
		log.info(`${name} ${taskName}  ${dim("MISS (no prior run)")}`);
		return;
	}
	const changed = firstDifferingComponent(components, last.components);
	log.info(
		`${name} ${taskName}  ${dim(`MISS (changed: ${changed ?? "unknown"})`)}`,
	);
}

/** Run `bun run <task>` in `cwd`, teeing stdout+stderr to the terminal while
 * capturing a combined log for replay on a future cache hit. */
async function spawnCapture(
	taskName: string,
	cwd: string,
): Promise<{ exitCode: number; output: string }> {
	const proc = Bun.spawn(["bun", "run", taskName], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
		env: process.env,
	});

	let output = "";
	const decoder = new TextDecoder();
	const pump = async (
		stream: ReadableStream<Uint8Array>,
		sink: NodeJS.WriteStream,
	): Promise<void> => {
		const reader = stream.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			output += decoder.decode(value, { stream: true });
			sink.write(value);
		}
	};

	await Promise.all([
		pump(proc.stdout, process.stdout),
		pump(proc.stderr, process.stderr),
	]);
	const exitCode = await proc.exited;
	return { exitCode, output };
}

function dim(msg: string): string {
	return process.env.NO_COLOR || !process.stdout.isTTY
		? msg
		: `\x1b[2m${msg}\x1b[0m`;
}
