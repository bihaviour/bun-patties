import type { RouteEntry } from "../types.ts";
import { assertNoConflicts } from "./conflict.ts";
import { compareRoutes, parseRouteFile } from "./pattern.ts";

const TEST_FILE_RE = /\.test\.tsx?$/;

export async function scanRoutes(appDir: string): Promise<RouteEntry[]> {
	const routesDir = appDir.replace(/\/+$/, "") + "/routes";

	const glob = new Bun.Glob("**/*.{ts,tsx}");
	const entries: RouteEntry[] = [];

	try {
		for await (const rel of glob.scan({ cwd: routesDir, onlyFiles: true })) {
			const base = rel.split("/").pop()!;
			if (base.startsWith("_")) continue;
			if (TEST_FILE_RE.test(base)) continue;

			const parsed = parseRouteFile(rel);
			entries.push({
				filePath: routesDir + "/" + rel,
				bunPattern: parsed.bunPattern,
				kind: parsed.kind,
				segments: parsed.segments,
			});
		}
	} catch (err) {
		// Missing routes/ dir: treat as no routes.
		const msg = (err as Error)?.message ?? "";
		if (/ENOENT|no such file/i.test(msg)) return [];
		throw err;
	}

	assertNoConflicts(entries);
	entries.sort(compareRoutes);
	return entries;
}
