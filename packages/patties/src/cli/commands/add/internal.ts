import { dirname, join } from "node:path";
import type { InternalHelper } from "patties-ui/types";
import { log } from "../../log.ts";

const FILES: Record<InternalHelper, string> = {
	cn: "cn.ts",
	slot: "slot.ts",
	variants: "variants.ts",
};

export async function stampInternals(
	helpers: InternalHelper[],
	cwd: string,
	templatesDir: string,
	opts: { dryRun: boolean },
): Promise<{ written: string[] }> {
	if (helpers.length === 0) return { written: [] };
	const written: string[] = [];
	for (const h of helpers) {
		const from = join(templatesDir, "_internal", FILES[h]);
		const to = join(cwd, "app", "components", "ui", "_internal", FILES[h]);
		if (await Bun.file(to).exists()) {
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
