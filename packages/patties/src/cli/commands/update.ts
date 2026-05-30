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
import { resolveUiPaths, UiPathError, type UiPaths } from "./add/ui-paths.ts";
import { resolveNames } from "./add.ts";

interface UpdateArgs {
	names: string[];
	all: boolean;
	dryRun: boolean;
}

const PROD_MSG =
	"patties update is a dev-only tool; refusing to run with NODE_ENV=production.";

// `patties update [<component>|--all]` — re-stamp stamped components from the
// catalog, after showing the drift. Overwrites local edits (the shown diff is
// the safeguard; commit before updating).
export async function runUpdate(
	argv: string[],
	ctx: CliContext,
): Promise<number> {
	const args = parseArgs(argv);

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
		log.error("patties-ui is not installed. Run `bun add -D patties-ui`.");
		return EXIT.USAGE;
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
		uiPaths = resolveUiPaths({ cwd: ctx.cwd, ui: loaded.config.ui });
	} catch (err) {
		if (err instanceof UiPathError) {
			log.error(err.message);
			return EXIT.USAGE;
		}
		throw err;
	}

	const entries = await selectEntries(catalog, uiPaths, args);
	if (entries === null) return EXIT.USAGE;
	if (entries.length === 0) {
		log.error("no components selected. Pass a name or --all.");
		return EXIT.USAGE;
	}

	const color = isTTY(process.stdout) && !process.env.NO_COLOR;
	for (const entry of entries) {
		log.info(entry.name);
		const items = await diffComponentItems(
			entry,
			uiPaths,
			catalog.templatesDir,
			color,
		);
		let drifted = false;
		for (const item of items) {
			if (item.status === "drift") {
				drifted = true;
				log.info(`  drift  ${item.label}`);
				process.stdout.write(`${item.body}\n`);
			}
		}
		if (!drifted) {
			log.dim("  up to date");
			continue;
		}
		if (args.dryRun) continue;
		try {
			await applyComponent(entry, ctx.cwd, uiPaths, catalog.templatesDir, {
				force: true,
			});
		} catch (err) {
			log.error(err instanceof Error ? err.message : String(err));
			return EXIT.ERROR;
		}
	}

	if (args.dryRun) {
		log.dim("dry-run: no files written.");
	} else {
		log.dim("done. Run `bun install` to fetch any new peer dependencies.");
	}
	return EXIT.OK;
}

async function selectEntries(
	catalog: Catalog,
	uiPaths: UiPaths,
	args: UpdateArgs,
): Promise<ComponentEntry[] | null> {
	if (args.names.length > 0) return resolveNames(catalog, args.names);
	if (args.all) return listStampedComponents(catalog, uiPaths);
	return [];
}

function parseArgs(argv: string[]): UpdateArgs {
	const out: UpdateArgs = { names: [], all: false, dryRun: false };
	for (const a of argv) {
		if (a === "--all") out.all = true;
		else if (a === "--dry-run") out.dryRun = true;
		else if (!a.startsWith("-")) out.names.push(a);
	}
	return out;
}
