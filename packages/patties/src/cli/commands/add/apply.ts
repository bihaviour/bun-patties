import type { ComponentEntry } from "patties-ui/types";
import { stampInternals } from "./internal.ts";
import { applyDeps, planDeps } from "./peer-deps.ts";
import { applyStamp, planStamp } from "./stamper.ts";
import { mergeTokens } from "./tokens.ts";
import type { UiPaths } from "./ui-paths.ts";

// Stamp a component's files, helpers, tokens, and peer deps. `force` overwrites
// existing files / re-merges the token block (used by `update`). Shared by
// `patties add` and `patties update`.
export async function applyComponent(
	entry: ComponentEntry,
	cwd: string,
	uiPaths: UiPaths,
	templatesDir: string,
	opts: { force: boolean; themeName?: string },
): Promise<void> {
	const plan = await planStamp(entry, uiPaths, templatesDir);
	const depPlan = await planDeps(entry.peerDeps, cwd);
	await stampInternals(entry.internalHelpers, uiPaths, templatesDir, {
		dryRun: false,
		force: opts.force,
	});
	await applyStamp(plan, { force: opts.force });
	await applyDeps(depPlan, cwd);
	await mergeTokens(entry.tokens ?? [], uiPaths, templatesDir, {
		dryRun: false,
		force: opts.force,
		themeName: opts.themeName,
	});
}
