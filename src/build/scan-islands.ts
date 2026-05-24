export interface IslandEntry {
	name: string;
	filePath: string;
	relPath: string;
}

const TEST_FILE_RE = /\.test\.tsx$/;

export async function scanIslands(appDir: string): Promise<IslandEntry[]> {
	const islandsDir = appDir.replace(/\/+$/, "") + "/islands";
	// Islands are React components — `.tsx` only. Plain `.ts` helpers next to
	// islands are not auto-registered. See spec 04 §"Client bundle".
	const glob = new Bun.Glob("**/*.tsx");
	const entries: IslandEntry[] = [];

	try {
		for await (const rel of glob.scan({ cwd: islandsDir, onlyFiles: true })) {
			const base = rel.split("/").pop()!;
			if (base.startsWith("_")) continue;
			if (TEST_FILE_RE.test(base)) continue;
			entries.push({
				name: islandNameFromRel(rel),
				filePath: islandsDir + "/" + rel,
				relPath: rel,
			});
		}
	} catch (err) {
		const msg = (err as Error)?.message ?? "";
		if (/ENOENT|no such file/i.test(msg)) return [];
		throw err;
	}

	entries.sort((a, b) => a.name.localeCompare(b.name));
	return entries;
}

function islandNameFromRel(rel: string): string {
	return rel.replace(/\.[tj]sx?$/, "").replace(/\//g, "-");
}
