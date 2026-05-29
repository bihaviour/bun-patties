import { join } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import { loadConfigOrUsage } from "../../config/load.ts";
import type { CliContext } from "../index.ts";
import { EXIT, isTTY, log } from "../log.ts";
import { applyComponent } from "./add/apply.ts";
import {
	diffComponentItems,
	listStampedComponents,
} from "./add/component-diff.ts";
import { type Catalog, loadCatalog } from "./add/load-catalog.ts";
import { planDeps } from "./add/peer-deps.ts";
import { planStamp } from "./add/stamper.ts";
import { themeExists } from "./add/tokens.ts";
import { resolveUiPaths, UiPathError, type UiPaths } from "./add/ui-paths.ts";
import { writeComponentView } from "./ui/view.ts";

interface AddArgs {
	names: string[];
	list: boolean;
	all: boolean;
	dryRun: boolean;
	force: boolean;
	help: boolean;
	path?: string;
	pathMissing: boolean;
	view: boolean;
	diff: boolean;
	check: boolean;
	theme?: string;
	themeMissing: boolean;
}

const PROD_MSG =
	"patties add is a dev-only tool; refusing to run with NODE_ENV=production.";

const MISSING_CATALOG_MSG =
	"patties-ui is not installed. Run `bun add -D patties-ui` to enable component stamping.";

export async function runAdd(argv: string[], ctx: CliContext): Promise<number> {
	const args = parseArgs(argv);

	if (args.help) {
		printHelp();
		return EXIT.OK;
	}

	if (process.env.NODE_ENV === "production") {
		log.error(PROD_MSG);
		return EXIT.USAGE;
	}

	if (args.pathMissing) {
		log.error("--path requires a directory value.");
		return EXIT.USAGE;
	}

	if (args.themeMissing) {
		log.error("--theme requires a preset name.");
		return EXIT.USAGE;
	}

	if (!(await Bun.file(join(ctx.cwd, "package.json")).exists())) {
		log.error(`not a Patties project (no package.json found at ${ctx.cwd})`);
		return EXIT.USAGE;
	}

	const catalog = await loadCatalog(ctx.cwd);
	if (!catalog) {
		log.error(MISSING_CATALOG_MSG);
		return EXIT.USAGE;
	}

	if (args.list) {
		printList(catalog);
		return EXIT.OK;
	}

	if (args.view) {
		const entries = resolveNames(catalog, args.names);
		if (entries === null) return EXIT.USAGE;
		if (entries.length === 0) {
			log.error("no components selected. Pass a component name.");
			return EXIT.USAGE;
		}
		for (const entry of entries) {
			await writeComponentView(entry, catalog.templatesDir);
		}
		return EXIT.OK;
	}

	const loaded = await loadConfigOrUsage({
		cwd: ctx.cwd,
		configPath: ctx.configPath,
	});
	if ("error" in loaded) {
		log.error(loaded.error);
		return EXIT.USAGE;
	}
	let uiPaths: UiPaths;
	try {
		uiPaths = resolveUiPaths({
			cwd: ctx.cwd,
			ui: loaded.config.ui,
			pathOverride: args.path,
		});
	} catch (err) {
		if (err instanceof UiPathError) {
			log.error(err.message);
			return EXIT.USAGE;
		}
		throw err;
	}

	if (args.diff) {
		return runDiff(catalog, uiPaths, args);
	}

	if (args.theme && !(await themeExists(catalog.templatesDir, args.theme))) {
		log.error(`unknown theme preset: ${args.theme}`);
		return EXIT.USAGE;
	}

	const entries = args.all
		? catalog.components.filter((c) => c.status === "completed")
		: resolveNames(catalog, args.names);
	if (entries === null) return EXIT.USAGE;
	if (entries.length === 0) {
		log.error("no components selected. Pass a name or --all.");
		printHelp();
		return EXIT.USAGE;
	}

	for (const entry of entries) {
		const rc = await stampOne(
			entry,
			ctx.cwd,
			uiPaths,
			catalog.templatesDir,
			args,
		);
		if (rc !== EXIT.OK) return rc;
	}

	if (args.dryRun) {
		log.dim("dry-run: no files written.");
	} else {
		log.dim("done. Run `bun install` to fetch any new peer dependencies.");
	}
	return EXIT.OK;
}

async function runDiff(
	catalog: Catalog,
	uiPaths: UiPaths,
	args: AddArgs,
): Promise<number> {
	const color = isTTY(process.stdout) && !process.env.NO_COLOR;
	const entries =
		args.names.length > 0
			? resolveNames(catalog, args.names)
			: await listStampedComponents(catalog, uiPaths);
	if (entries === null) return EXIT.USAGE;

	let drift = false;
	for (const entry of entries) {
		const items = await diffComponentItems(
			entry,
			uiPaths,
			catalog.templatesDir,
			color,
		);
		log.info(entry.name);
		for (const item of items) {
			if (item.status === "drift") {
				drift = true;
				log.info(`  drift  ${item.label}`);
				process.stdout.write(`${item.body}\n`);
			} else if (item.status === "not-stamped") {
				log.dim(`  not stamped  ${item.label}`);
			} else {
				log.dim(`  up to date   ${item.label}`);
			}
		}
	}

	if (args.check) return drift ? EXIT.ERROR : EXIT.OK;
	return EXIT.OK;
}

export function resolveNames(
	catalog: Catalog,
	names: string[],
): ComponentEntry[] | null {
	const out: ComponentEntry[] = [];
	for (const name of names) {
		const entry = catalog.components.find((c) => c.name === name);
		if (!entry) {
			log.error(`unknown component: ${name}`);
			return null;
		}
		out.push(entry);
	}
	return out;
}

async function stampOne(
	entry: ComponentEntry,
	cwd: string,
	uiPaths: UiPaths,
	templatesDir: string,
	args: AddArgs,
): Promise<number> {
	log.info(
		`${entry.name}  (phase ${entry.phase}, island=${entry.island}, ${entry.status})`,
	);

	if (args.dryRun) {
		const plan = await planStamp(entry, uiPaths, templatesDir);
		const depPlan = await planDeps(entry.peerDeps, cwd);
		for (const p of plan) {
			const marker = p.exists ? "exists" : "new";
			log.dim(`  [${marker}] ${p.to}`);
		}
		for (const [name, range] of Object.entries(depPlan.added)) {
			log.dim(`  + ${name}@${range}`);
		}
		for (const c of depPlan.conflicted) {
			log.dim(`  ! ${c.name}: user ${c.user} vs requested ${c.requested}`);
		}
		for (const g of entry.tokens ?? []) log.dim(`  tokens: ${g}`);
		for (const h of entry.internalHelpers) {
			log.dim(`  helper: _internal/${h}.ts`);
		}
		return EXIT.OK;
	}

	try {
		await applyComponent(entry, cwd, uiPaths, templatesDir, {
			force: args.force,
			themeName: args.theme,
		});
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		return EXIT.ERROR;
	}
	return EXIT.OK;
}

function printList(catalog: Catalog): void {
	const rows = catalog.components;
	const widths = {
		name: Math.max(4, ...rows.map((r) => r.name.length)),
		phase: 5,
		island: Math.max(6, ...rows.map((r) => r.island.length)),
		status: Math.max(6, ...rows.map((r) => r.status.length)),
	};
	const header = `${pad("name", widths.name)}  ${pad("phase", widths.phase)}  ${pad("island", widths.island)}  ${pad("status", widths.status)}`;
	log.info(header);
	log.dim("-".repeat(header.length));
	for (const r of rows) {
		log.info(
			`${pad(r.name, widths.name)}  ${pad(String(r.phase), widths.phase)}  ${pad(r.island, widths.island)}  ${pad(r.status, widths.status)}`,
		);
	}
}

function pad(s: string, n: number): string {
	return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function parseArgs(argv: string[]): AddArgs {
	const out: AddArgs = {
		names: [],
		list: false,
		all: false,
		dryRun: false,
		force: false,
		help: false,
		pathMissing: false,
		view: false,
		diff: false,
		check: false,
		themeMissing: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--list") out.list = true;
		else if (a === "--all") out.all = true;
		else if (a === "--dry-run") out.dryRun = true;
		else if (a === "--force") out.force = true;
		else if (a === "--view") out.view = true;
		else if (a === "--diff") out.diff = true;
		else if (a === "--check") out.check = true;
		else if (a === "--help" || a === "-h") out.help = true;
		else if (a === "--path") {
			const v = argv[++i];
			if (v === undefined) out.pathMissing = true;
			else out.path = v;
		} else if (a.startsWith("--path=")) {
			out.path = a.slice("--path=".length);
		} else if (a === "--theme") {
			const v = argv[++i];
			if (v === undefined) out.themeMissing = true;
			else out.theme = v;
		} else if (a.startsWith("--theme=")) {
			out.theme = a.slice("--theme=".length);
		} else out.names.push(a);
	}
	return out;
}

function printHelp(): void {
	process.stdout.write(`patties add — stamp UI components into your project

Usage:
  patties add <component> [...components]
  patties add --all
  patties add --list
  patties add --dry-run <component>

Requires patties-ui to be installed: bun add -D patties-ui

Flags:
  --all          Stamp every component whose status is completed.
  --list         Print every component with phase, island flag, and status.
  --dry-run      Print the file/dep diff without writing.
  --force        Overwrite existing files.
  --view         Print the component's source instead of stamping.
  --diff         Show how stamped files drift from the catalog (read-only).
  --check        With --diff, exit non-zero if any component has drifted.
  --path <dir>   Stamp into <dir> for this invocation (overrides config.ui).
  --theme <name> Merge a base-color preset's tokens (neutral|slate|stone|zinc).
`);
}
