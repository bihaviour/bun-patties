import { type FSWatcher, watch } from "node:fs";

// `bun --hot` / `--watch` only see files already in the module graph, so a
// newly added route (or a deleted one) never triggers a reload and the route
// table built at startup goes stale. `patties dev` watches the app tree for
// files appearing or disappearing and restarts the dev process — the one
// place runtime re-scanning is allowed (.claude/rules/build-time-discovery.md).
//
// Content edits are deliberately ignored: they belong to `bun --hot`. The
// comparison is on the set of files, so editors that save atomically
// (write a temp file, rename it over the original) don't cause restarts.

const SOURCE_GLOB = "**/*.{ts,tsx,js,jsx,mts,mjs,cts,cjs}";
const DEBOUNCE_MS = 75;

export interface AppTreeWatcher {
	close(): void;
}

export function snapshotAppTree(appDir: string): Set<string> {
	const files = new Set<string>();
	const glob = new Bun.Glob(SOURCE_GLOB);
	try {
		// `dot: false` (the default) keeps the `.patties` build output out.
		for (const rel of glob.scanSync({ cwd: appDir, onlyFiles: true })) {
			if (rel.startsWith("node_modules/") || rel.includes("/node_modules/")) {
				continue;
			}
			files.add(rel);
		}
	} catch {
		// Missing app dir: an empty tree; a later `mkdir app` shows up as a change.
	}
	return files;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
	if (a.size !== b.size) return false;
	for (const v of a) if (!b.has(v)) return false;
	return true;
}

export function watchAppTree(
	appDir: string,
	onStructureChange: () => void,
): AppTreeWatcher {
	let known = snapshotAppTree(appDir);
	let timer: ReturnType<typeof setTimeout> | null = null;

	const check = (): void => {
		timer = null;
		const next = snapshotAppTree(appDir);
		if (sameSet(known, next)) return;
		known = next;
		onStructureChange();
	};

	let watcher: FSWatcher | null = null;
	try {
		watcher = watch(appDir, { recursive: true }, (_event, filename) => {
			const rel = filename ? String(filename) : "";
			if (rel.startsWith(".") || rel.includes("node_modules")) return;
			if (timer) clearTimeout(timer);
			timer = setTimeout(check, DEBOUNCE_MS);
		});
	} catch {
		// No app dir to watch; dev still runs, just without restart-on-add.
	}

	return {
		close() {
			if (timer) clearTimeout(timer);
			watcher?.close();
		},
	};
}
