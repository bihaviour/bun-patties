import { dirname, resolve, sep } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import { log } from "../../log.ts";
import type { UiPaths } from "./ui-paths.ts";

export interface StampPlan {
	from: string;
	to: string;
	exists: boolean;
}

export async function planStamp(
	entry: ComponentEntry,
	uiPaths: UiPaths,
	templatesDir: string,
): Promise<StampPlan[]> {
	const out: StampPlan[] = [];
	const tplRoot = resolve(templatesDir);
	const compRoot = resolve(uiPaths.componentsDir);
	for (const f of entry.files) {
		// Defense-in-depth: ComponentFileSchema already rejects unsafe from/to,
		// but assert each join stays within its root before any read/write.
		const from = resolve(templatesDir, f.from);
		const to = resolve(uiPaths.componentsDir, f.to);
		if (from !== tplRoot && !from.startsWith(tplRoot + sep)) {
			throw new Error(
				`unsafe template source escapes templates dir: ${f.from}`,
			);
		}
		if (to !== compRoot && !to.startsWith(compRoot + sep)) {
			throw new Error(
				`unsafe component target escapes components dir: ${f.to}`,
			);
		}
		out.push({ from, to, exists: await Bun.file(to).exists() });
	}
	return out;
}

export async function applyStamp(
	plan: StampPlan[],
	opts: { force: boolean },
): Promise<{ written: number; skipped: number }> {
	let written = 0;
	let skipped = 0;
	for (const p of plan) {
		if (p.exists && !opts.force) {
			log.dim(`  skip ${p.to} (exists)`);
			skipped++;
			continue;
		}
		const src = Bun.file(p.from);
		if (!(await src.exists())) {
			log.error(`missing template: ${p.from}`);
			throw new Error(`template not found: ${p.from}`);
		}
		await ensureDir(dirname(p.to));
		await Bun.write(p.to, src);
		log.success(`  wrote ${p.to}`);
		written++;
	}
	return { written, skipped };
}

async function ensureDir(dir: string): Promise<void> {
	await Bun.$`mkdir -p ${dir}`.quiet();
}
