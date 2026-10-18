// Config group — whole-tree hydration hygiene. A page that exports
// `hydrate = true` hydrates its entire subtree, so `<Island>` wrappers on it
// are dead weight (whole-tree wins; the island entry is never loaded).

import { relative } from "node:path";
import {
	type HydrateDefault,
	readHydrateFlag,
} from "../../build/page-entry.ts";
import { scanRoutes } from "../../router/filesystem.ts";
import type { Finding } from "./types.ts";

const ISLAND_USE_RE = /<Island[\s>]/;

export async function checkHydration(
	cwd: string,
	appDir: string,
	defaultMode: HydrateDefault,
): Promise<Finding[]> {
	let entries: Awaited<ReturnType<typeof scanRoutes>>;
	try {
		entries = await scanRoutes(appDir);
	} catch {
		return [];
	}
	const out: Finding[] = [];
	let hydrated = 0;
	for (const entry of entries) {
		if (entry.kind !== "page") continue;
		const source = await Bun.file(entry.filePath).text();
		let flag: boolean;
		try {
			flag = readHydrateFlag(source, entry.filePath, defaultMode).hydrate;
		} catch (err) {
			out.push({
				id: "hydrate-export",
				group: "Config",
				status: "fail",
				detail: (err as Error).message.replace(/^patties build: /, ""),
				remedy: "export `hydrate` as a literal: export const hydrate = true",
			});
			continue;
		}
		if (!flag) continue;
		hydrated++;
		if (ISLAND_USE_RE.test(source)) {
			out.push({
				id: "hydrate-islands",
				group: "Config",
				status: "warn",
				detail: `${relative(cwd, entry.filePath)} hydrates the whole page but also renders <Island>; the island markers are redundant`,
				remedy: "drop the <Island> wrappers, or export const hydrate = false",
			});
		}
	}
	if (hydrated > 0 && out.length === 0) {
		out.push({
			id: "hydrate",
			group: "Config",
			status: "pass",
			detail: `${hydrated} hydrated page(s), no island overlap`,
		});
	}
	return out;
}
