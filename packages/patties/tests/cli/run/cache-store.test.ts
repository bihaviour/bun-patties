import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import type { KeyComponents } from "../../../src/cli/run/cache-key.ts";
import { CacheStore } from "../../../src/cli/run/cache-store.ts";

let workdir: string;
let cacheDir: string;

const COMPONENTS = {
	cacheFormatVersion: 1,
	task: { name: "build", command: "echo" },
	inputsHash: "x",
	externalDeps: { lockHash: "", direct: {} },
	internalDepKeys: {},
	globalInputs: { rootConfig: "", rootTsconfig: "", packageJson: "" },
	envValues: {},
	toolVersions: { bun: "1", patties: "0" },
	platform: { platform: "darwin", arch: "arm64" },
} satisfies KeyComponents;

beforeEach(async () => {
	workdir = (await Bun.$`mktemp -d -t patties-store.XXXXXX`.text()).trim();
	cacheDir = join(workdir, ".patties", "cache");
});

afterEach(async () => {
	await Bun.$`rm -rf ${workdir}`.quiet();
});

test("put then restore round-trips declared outputs byte-identically", async () => {
	const pkgDir = join(workdir, "pkg");
	await Bun.write(join(pkgDir, "dist", "a.txt"), "alpha");
	await Bun.write(join(pkgDir, "dist", "nested", "b.txt"), "beta");

	const store = await CacheStore.open(cacheDir);
	await store.put({
		key: "k1",
		pkgDir,
		outputs: ["dist/**"],
		log: "build log",
		exitCode: 0,
		components: COMPONENTS,
		packageName: "pkg",
		taskName: "build",
	});
	expect(store.has("k1")).toBe(true);

	await Bun.$`rm -rf ${join(pkgDir, "dist")}`.quiet();
	expect(await store.restore("k1", pkgDir)).toBe(true);
	expect(await Bun.file(join(pkgDir, "dist", "a.txt")).text()).toBe("alpha");
	expect(await Bun.file(join(pkgDir, "dist", "nested", "b.txt")).text()).toBe(
		"beta",
	);
	store.close();
});

test("an orphan tarball+log without an index row is NOT a hit (crash safety)", async () => {
	const store = await CacheStore.open(cacheDir);
	// Simulate a crash after the tarball/log landed but before the row insert.
	await Bun.write(join(cacheDir, "orphan.tar.gz"), new Uint8Array([1, 2, 3]));
	await Bun.write(join(cacheDir, "orphan.log"), "partial");
	expect(store.has("orphan")).toBe(false);
	store.close();
});

test("survives reopen (WAL) and reports the recorded last run", async () => {
	const pkgDir = join(workdir, "pkg");
	await Bun.write(join(pkgDir, "dist", "o"), "out");
	let store = await CacheStore.open(cacheDir);
	await store.put({
		key: "k2",
		pkgDir,
		outputs: ["dist/**"],
		log: "",
		exitCode: 0,
		components: COMPONENTS,
		packageName: "pkg",
		taskName: "build",
	});
	store.close();

	store = await CacheStore.open(cacheDir);
	expect(store.has("k2")).toBe(true);
	expect(store.lastRun("pkg", "build")?.key).toBe("k2");
	expect(store.lastRun("pkg", "missing")).toBeNull();
	store.close();
});
