import { dirname, join } from "node:path";
import type { InternalHelper } from "patties-ui/types";
import { log } from "../../log.ts";
import type { UiPaths } from "./ui-paths.ts";

export const INTERNAL_FILES: Record<InternalHelper, string> = {
	cn: "cn.ts",
	slot: "slot.ts",
	variants: "variants.ts",
};

const FILES = INTERNAL_FILES;

export async function stampInternals(
	helpers: InternalHelper[],
	uiPaths: UiPaths,
	templatesDir: string,
	opts: { dryRun: boolean; force?: boolean },
): Promise<{ written: string[] }> {
	if (helpers.length === 0) return { written: [] };
	const written: string[] = [];
	for (const h of helpers) {
		const from = join(templatesDir, "_internal", FILES[h]);
		const to = join(uiPaths.internalDir, FILES[h]);
		if ((await Bun.file(to).exists()) && !opts.force) {
			log.dim(`  helper _internal/${FILES[h]} present`);
			continue;
		}
		const src = Bun.file(from);
		if (!(await src.exists())) {
			throw new Error(`missing internal template: ${from}`);
		}
		if (!opts.dryRun) {
			await Bun.$`mkdir -p ${dirname(to)}`.quiet();
			await Bun.write(to, src);
		}
		log.success(`  wrote ${to}`);
		written.push(to);
	}
	return { written };
}
