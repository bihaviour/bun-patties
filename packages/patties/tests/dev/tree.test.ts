import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type AppTreeWatcher,
	snapshotAppTree,
	watchAppTree,
} from "../../src/dev/tree.ts";

let appDir: string;
let watcher: AppTreeWatcher | null = null;
let changes = 0;

const settle = () => Bun.sleep(300);

beforeEach(async () => {
	appDir = mkdtempSync(join(tmpdir(), "patties-tree-"));
	mkdirSync(join(appDir, "routes"));
	writeFileSync(join(appDir, "routes/index.tsx"), "export default 1;");
	changes = 0;
	watcher = watchAppTree(appDir, () => {
		changes++;
	});
	// macOS FSEvents can deliver the creation events above after the watcher
	// starts; let them drain before each test's baseline.
	await settle();
	changes = 0;
});

afterEach(() => {
	watcher?.close();
	watcher = null;
	rmSync(appDir, { recursive: true, force: true });
});

test("snapshotAppTree lists sources and skips build output and node_modules", () => {
	mkdirSync(join(appDir, ".patties/client"), { recursive: true });
	writeFileSync(join(appDir, ".patties/client/entry.js"), "");
	mkdirSync(join(appDir, "node_modules/x"), { recursive: true });
	writeFileSync(join(appDir, "node_modules/x/index.js"), "");
	writeFileSync(join(appDir, "routes/notes.md"), "");
	expect([...snapshotAppTree(appDir)]).toEqual(["routes/index.tsx"]);
});

test("adding a route file fires", async () => {
	writeFileSync(join(appDir, "routes/about.tsx"), "export default 2;");
	await settle();
	expect(changes).toBe(1);
});

test("deleting a route file fires", async () => {
	unlinkSync(join(appDir, "routes/index.tsx"));
	await settle();
	expect(changes).toBe(1);
});

test("moving in a directory of routes fires", async () => {
	const outside = mkdtempSync(join(tmpdir(), "patties-tree-src-"));
	writeFileSync(join(outside, "post.tsx"), "export default 3;");
	renameSync(outside, join(appDir, "routes/blog"));
	await settle();
	expect(changes).toBe(1);
});

test("editing an existing file does not fire (bun --hot owns edits)", async () => {
	writeFileSync(join(appDir, "routes/index.tsx"), "export default 42;");
	await settle();
	expect(changes).toBe(0);
});

test("an atomic save (temp file renamed over the original) does not fire", async () => {
	const tmp = join(appDir, "routes/index.tsx.tmp-123");
	writeFileSync(tmp, "export default 7;");
	renameSync(tmp, join(appDir, "routes/index.tsx"));
	await settle();
	expect(changes).toBe(0);
});

test("writes under .patties (dev build output) do not fire", async () => {
	mkdirSync(join(appDir, ".patties/client"), { recursive: true });
	writeFileSync(join(appDir, ".patties/client/entry-abc.js"), "");
	await settle();
	expect(changes).toBe(0);
});
