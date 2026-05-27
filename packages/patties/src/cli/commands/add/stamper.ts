import { dirname, join } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import { log } from "../../log.ts";
import { resolveTemplatesDir } from "./resolve-templates.ts";

export interface StampPlan {
	from: string;
	to: string;
	exists: boolean;
}

export async function planStamp(
	entry: ComponentEntry,
	cwd: string,
): Promise<StampPlan[]> {
	const templates = await resolveTemplatesDir();
	const out: StampPlan[] = [];
	for (const f of entry.files) {
		const from = join(templates, f.from);
		const to = join(cwd, "app", "components", "ui", f.to);
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
