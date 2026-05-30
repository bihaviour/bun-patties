import { join } from "node:path";
import { log } from "../../log.ts";

interface PackageJson {
	dependencies?: Record<string, string>;
	[key: string]: unknown;
}

export interface DepPlan {
	added: Record<string, string>;
	conflicted: Array<{ name: string; user: string; requested: string }>;
}

export async function planDeps(
	wanted: Record<string, string>,
	cwd: string,
): Promise<DepPlan> {
	const pkg = await readPkg(cwd);
	const existing = pkg.dependencies ?? {};
	const added: Record<string, string> = {};
	const conflicted: DepPlan["conflicted"] = [];
	for (const [name, range] of Object.entries(wanted)) {
		const current = existing[name];
		if (current === undefined) {
			added[name] = range;
		} else if (current !== range) {
			conflicted.push({ name, user: current, requested: range });
		}
	}
	return { added, conflicted };
}

export async function applyDeps(plan: DepPlan, cwd: string): Promise<boolean> {
	if (Object.keys(plan.added).length === 0) {
		for (const c of plan.conflicted) {
			log.warn(
				`dep ${c.name}: keeping user range ${c.user} (component wants ${c.requested})`,
			);
		}
		return false;
	}
	const path = join(cwd, "package.json");
	const pkg = await readPkg(cwd);
	pkg.dependencies = { ...(pkg.dependencies ?? {}), ...plan.added };
	pkg.dependencies = sortKeys(pkg.dependencies);
	await Bun.write(path, `${JSON.stringify(pkg, null, "\t")}\n`);
	for (const [name, range] of Object.entries(plan.added)) {
		log.success(`  + ${name}@${range}`);
	}
	for (const c of plan.conflicted) {
		log.warn(
			`  ${c.name}: keeping user range ${c.user} (component wants ${c.requested})`,
		);
	}
	return true;
}

async function readPkg(cwd: string): Promise<PackageJson> {
	const file = Bun.file(join(cwd, "package.json"));
	return (await file.json()) as PackageJson;
}

function sortKeys(record: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const key of Object.keys(record).sort()) {
		const v = record[key];
		if (v !== undefined) out[key] = v;
	}
	return out;
}
