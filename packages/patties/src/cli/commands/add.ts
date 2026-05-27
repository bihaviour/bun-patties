import { join } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import type { CliContext } from "../index.ts";
import { EXIT, log } from "../log.ts";
import { stampInternals } from "./add/internal.ts";
import { type Catalog, loadCatalog } from "./add/load-catalog.ts";
import { applyDeps, planDeps } from "./add/peer-deps.ts";
import { applyStamp, planStamp } from "./add/stamper.ts";
import { mergeTokens } from "./add/tokens.ts";

interface AddArgs {
	names: string[];
	list: boolean;
	all: boolean;
	dryRun: boolean;
	force: boolean;
	help: boolean;
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
		const rc = await stampOne(entry, ctx.cwd, catalog.templatesDir, args);
		if (rc !== EXIT.OK) return rc;
	}

	if (args.dryRun) {
		log.dim("dry-run: no files written.");
	} else {
		log.dim("done. Run `bun install` to fetch any new peer dependencies.");
	}
	return EXIT.OK;
}

function resolveNames(
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
	templatesDir: string,
	args: AddArgs,
): Promise<number> {
	log.info(
		`${entry.name}  (phase ${entry.phase}, island=${entry.island}, ${entry.status})`,
	);

	const plan = await planStamp(entry, cwd, templatesDir);
	const depPlan = await planDeps(entry.peerDeps, cwd);

	if (args.dryRun) {
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
		await stampInternals(entry.internalHelpers, cwd, templatesDir, {
			dryRun: false,
		});
		await applyStamp(plan, { force: args.force });
		await applyDeps(depPlan, cwd);
		await mergeTokens(entry.tokens ?? [], cwd, templatesDir, { dryRun: false });
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
	};
	for (const a of argv) {
		if (a === "--list") out.list = true;
		else if (a === "--all") out.all = true;
		else if (a === "--dry-run") out.dryRun = true;
		else if (a === "--force") out.force = true;
		else if (a === "--help" || a === "-h") out.help = true;
		else out.names.push(a);
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
  --all        Stamp every component whose status is completed.
  --list       Print every component with phase, island flag, and status.
  --dry-run    Print the file/dep diff without writing.
  --force      Overwrite existing files.
`);
}
