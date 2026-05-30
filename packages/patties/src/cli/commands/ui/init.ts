import { join } from "node:path";
import { loadConfigOrUsage } from "../../../config/load.ts";
import type { CliContext } from "../../index.ts";
import { EXIT, log } from "../../log.ts";
import { stampInternals } from "../add/internal.ts";
import { loadCatalog } from "../add/load-catalog.ts";
import { applyDeps, planDeps } from "../add/peer-deps.ts";
import { mergeTokens, themeExists } from "../add/tokens.ts";
import { resolveUiPaths, UiPathError, type UiPaths } from "../add/ui-paths.ts";

export interface UiInitArgs {
	dryRun: boolean;
	force: boolean;
	theme?: string;
	themeMissing?: boolean;
}

const PROD_MSG =
	"patties ui init is a dev-only tool; refusing to run with NODE_ENV=production.";

// Base helper deps for the cn() utility. Kept in sync with the registry's `cn`
// constant; init lays these down before any component is stamped.
const BASE_DEPS: Record<string, string> = {
	clsx: "^2.1.0",
	"tailwind-merge": "^2.5.0",
};

export async function runUiInit(
	args: UiInitArgs,
	ctx: CliContext,
): Promise<number> {
	if (args.themeMissing) {
		log.error("--theme requires a preset name.");
		return EXIT.USAGE;
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
		log.error(
			"patties-ui is not installed. Run `bun add -D patties-ui` to enable UI setup.",
		);
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

	if (args.theme && !(await themeExists(catalog.templatesDir, args.theme))) {
		log.error(`unknown theme preset: ${args.theme}`);
		return EXIT.USAGE;
	}

	try {
		await mergeTokens(["base"], uiPaths, catalog.templatesDir, {
			dryRun: args.dryRun,
			force: args.force,
			themeName: args.theme,
		});
		await stampInternals(["cn"], uiPaths, catalog.templatesDir, {
			dryRun: args.dryRun,
			force: args.force,
		});
		if (!args.dryRun) {
			const depPlan = await planDeps(BASE_DEPS, ctx.cwd);
			await applyDeps(depPlan, ctx.cwd);
		} else {
			for (const [name, range] of Object.entries(BASE_DEPS)) {
				log.dim(`  + ${name}@${range}`);
			}
		}
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err));
		return EXIT.ERROR;
	}

	printWiring(uiPaths.tokensFile);

	if (args.dryRun) {
		log.dim("dry-run: no files written.");
	} else {
		log.dim("done. Run `bun install` to fetch the new peer dependencies.");
	}
	return EXIT.OK;
}

// patties never edits the user's stylesheet; it prints the wiring to add once.
function printWiring(tokensFile: string): void {
	log.info("  tailwind   add to your app.css (patties never edits it):");
	log.dim(`               @import "tailwindcss";`);
	log.dim(`               @import "${relTokensImport(tokensFile)}";`);
	log.dim(`               @theme inline { /* map --color-* to the tokens */ }`);
}

function relTokensImport(tokensFile: string): string {
	// Best-effort hint: most projects import tokens relative to app.css.
	const base = tokensFile.split("/").slice(-2).join("/");
	return `./${base}`;
}
