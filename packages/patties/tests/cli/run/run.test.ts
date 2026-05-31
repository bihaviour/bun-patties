import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import { runRun } from "../../../src/cli/run.ts";
import { cleanup, createMonorepo, type Repo } from "./harness.ts";

let repo: Repo;

beforeEach(async () => {
	repo = await createMonorepo();
});

afterEach(async () => {
	await cleanup(repo);
});

// Drive the command with the chatty task output swallowed so the suite stays
// readable; the return code and filesystem effects are what we assert on.
async function run(...args: string[]): Promise<number> {
	const origOut = process.stdout.write;
	const origErr = process.stderr.write;
	process.stdout.write = (() => true) as typeof process.stdout.write;
	process.stderr.write = (() => true) as typeof process.stderr.write;
	try {
		return await runRun(args, { cwd: repo.dir, verbose: false });
	} finally {
		process.stdout.write = origOut;
		process.stderr.write = origErr;
	}
}

test("cold run executes every package; a warm re-run spawns nothing", async () => {
	expect(await run("build")).toBe(0);
	expect(await repo.runCount("a")).toBe(1);
	expect(await repo.runCount("b")).toBe(1);
	expect(await repo.runCount("c")).toBe(1);

	expect(await run("build")).toBe(0);
	expect(await repo.runCount("a")).toBe(1); // cache hit ⇒ not re-spawned
	expect(await repo.runCount("b")).toBe(1);
	expect(await repo.runCount("c")).toBe(1);
});

test("a cache hit restores declared outputs byte-identically", async () => {
	await run("build");
	const before = await repo.read("packages/a/dist/out.txt");
	await repo.rm("packages/a/dist");
	await repo.rm("packages/b/dist");

	expect(await run("build")).toBe(0);
	expect(await repo.runCount("a")).toBe(1); // restored, not rebuilt
	expect(await repo.read("packages/a/dist/out.txt")).toBe(before);
	expect(await repo.read("packages/b/dist/out.txt")).toBe("b\n");
});

test("editing a leaf invalidates it and its dependents only", async () => {
	await run("build");
	await repo.editSource("a", "changed");

	expect(await run("build")).toBe(0);
	expect(await repo.runCount("a")).toBe(2); // input changed ⇒ miss
	expect(await repo.runCount("b")).toBe(2); // internalDepKeys changed ⇒ miss
	expect(await repo.runCount("c")).toBe(1); // unrelated ⇒ still a hit
});

test("--affected runs only changed packages + their dependents", async () => {
	await run("build");
	await repo.editSource("a", "changed");
	await repo.commitAll("edit-a");

	expect(await run("build", "--affected", "--since", "HEAD~1")).toBe(0);
	expect(await repo.runCount("a")).toBe(2);
	expect(await repo.runCount("b")).toBe(2);
	expect(await repo.runCount("c")).toBe(1); // not affected ⇒ never even looked up
});

test("a root-level change marks every package affected", async () => {
	await run("build");
	await Bun.write(
		join(repo.dir, "patties.config.ts"),
		`export default { tasks: { build: { inputs: ["src/**"], outputs: ["dist/**"], env: ["X"] } } };\n`,
	);
	await repo.commitAll("edit-root");

	expect(await run("build", "--affected", "--since", "HEAD~1")).toBe(0);
	// Every key shifts on a root-config change ⇒ all three rebuild.
	expect(await repo.runCount("a")).toBe(2);
	expect(await repo.runCount("b")).toBe(2);
	expect(await repo.runCount("c")).toBe(2);
});

test("--dry-run reports without executing anything", async () => {
	await run("build");
	await repo.editSource("a", "changed");

	expect(await run("build", "--dry-run")).toBe(0);
	expect(await repo.runCount("a")).toBe(1); // nothing ran
	expect(await repo.runCount("b")).toBe(1);
});

test("--force re-runs even on a hit", async () => {
	await run("build");
	expect(await run("build", "--force")).toBe(0);
	expect(await repo.runCount("a")).toBe(2);
});

test("--no-cache always runs and never serves a hit", async () => {
	expect(await run("build", "--no-cache")).toBe(0);
	expect(await run("build", "--no-cache")).toBe(0);
	expect(await repo.runCount("a")).toBe(2);
});

test("--remote is rejected as a Phase 2 feature", async () => {
	expect(await run("build", "--remote")).toBe(2);
});

test("missing <task> is a usage error", async () => {
	expect(await run()).toBe(2);
});
