import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	dependentsClosure,
	discoverWorkspace,
	type Workspace,
} from "../../../src/cli/run/workspace.ts";
import { cleanup, createMonorepo, type Repo } from "./harness.ts";

let repo: Repo;
let ws: Workspace;

beforeEach(async () => {
	repo = await createMonorepo();
	ws = await discoverWorkspace(repo.dir);
});

afterEach(async () => {
	await cleanup(repo);
});

test("discovers all workspace packages", () => {
	expect([...ws.packages.keys()].sort()).toEqual(["a", "b", "c"]);
});

test("derives internal deps from workspace: specifiers", () => {
	expect(ws.packages.get("b")?.internalDeps).toEqual(["a"]);
	expect(ws.packages.get("a")?.internalDeps).toEqual([]);
});

test("orders dependencies before dependents", () => {
	const order = ws.topoOrder;
	expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
});

test("maps file paths to the owning package, null for root-level", () => {
	expect(ws.fileToPackage("packages/a/src/v.txt")).toBe("a");
	expect(ws.fileToPackage("packages/b/package.json")).toBe("b");
	expect(ws.fileToPackage("patties.config.ts")).toBeNull();
	expect(ws.fileToPackage("bun.lock")).toBeNull();
});

test("reverse-graph closure includes transitive dependents", () => {
	expect([...dependentsClosure(ws, ["a"])].sort()).toEqual(["a", "b"]);
	expect([...dependentsClosure(ws, ["c"])].sort()).toEqual(["c"]);
});

test("rejects a non-workspace root", async () => {
	const tmp = (await Bun.$`mktemp -d`.text()).trim();
	await Bun.write(`${tmp}/package.json`, JSON.stringify({ name: "solo" }));
	expect(discoverWorkspace(tmp)).rejects.toThrow(/Bun-workspace monorepo/);
	await Bun.$`rm -rf ${tmp}`.quiet();
});
