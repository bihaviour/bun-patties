import { afterAll, expect, test } from "bun:test";
import { assertSingleReact, resolveReexecEntry } from "../../src/cli/dev.ts";

// Spec 26 — workspace-aware single-React resolution. These are synthetic-tree
// unit tests (mktemp + Bun.write, no `bun install`): they exercise the bin
// upward search and the duplicate-React guard directly.
//
// The full `create-patties --monorepo` + `bun install` + `bun --filter web dev`
// SSR test and the `build` + `start` test from the spec are deferred until
// those commands exist (create-patties `--monorepo` is draft `cli/18,19`; there
// is no `patties start` command). The production build's single-copy guarantee
// already comes from `Bun.build` walking up to the hoisted root, covered by
// `tests/integration/build.test.ts`.

const created: string[] = [];

afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
});

async function tmp(): Promise<string> {
	const dir = (await Bun.$`mktemp -d -t patties-dev-res.XXXXXX`.text()).trim();
	created.push(dir);
	return dir;
}

const PATTIES_BIN = "node_modules/patties/bin/patties.ts";

test("resolveReexecEntry: monorepo — climbs to the hoisted root bin", async () => {
	const root = await tmp();
	await Bun.write(`${root}/${PATTIES_BIN}`, "// bin\n");
	await Bun.write(`${root}/apps/web/package.json`, "{}\n");

	// `cwd` is the app dir, where `patties` is NOT installed (it's hoisted).
	expect(resolveReexecEntry(`${root}/apps/web`)).toBe(`${root}/${PATTIES_BIN}`);
});

test("resolveReexecEntry: flat app — matches on the first iteration", async () => {
	const root = await tmp();
	await Bun.write(`${root}/${PATTIES_BIN}`, "// bin\n");

	expect(resolveReexecEntry(root)).toBe(`${root}/${PATTIES_BIN}`);
});

test("resolveReexecEntry: no patties anywhere — falls back to argv[1]", async () => {
	const root = await tmp();
	await Bun.write(`${root}/apps/web/package.json`, "{}\n");

	expect(resolveReexecEntry(`${root}/apps/web`)).toBe(process.argv[1] ?? "");
});

async function writeReact(path: string, version: string): Promise<void> {
	await Bun.write(
		`${path}/package.json`,
		JSON.stringify({ name: "react", version, main: "index.js" }),
	);
	await Bun.write(`${path}/index.js`, "module.exports = {};\n");
}

test("assertSingleReact: single hoisted copy — ok", async () => {
	const root = await tmp();
	await writeReact(`${root}/node_modules/react`, "1903.0.0");
	await Bun.write(
		`${root}/node_modules/patties/package.json`,
		'{"name":"patties"}',
	);
	await Bun.write(`${root}/apps/web/app/.keep`, "");

	const res = assertSingleReact(
		`${root}/apps/web`, // projectDir
		`${root}/apps/web/app`, // appDir
		`${root}/node_modules/patties`, // frameworkDir
	);
	expect(res.ok).toBe(true);
});

test("assertSingleReact: nested app copy diverges from framework — fails with both paths", async () => {
	const root = await tmp();
	await writeReact(`${root}/node_modules/react`, "1903.0.0"); // hoisted (framework)
	await writeReact(`${root}/apps/web/node_modules/react`, "1900.0.0"); // nested (app)
	await Bun.write(
		`${root}/node_modules/patties/package.json`,
		'{"name":"patties"}',
	);
	await Bun.write(`${root}/apps/web/app/.keep`, "");

	const res = assertSingleReact(
		`${root}/apps/web`,
		`${root}/apps/web/app`,
		`${root}/node_modules/patties`,
	);

	expect(res.ok).toBe(false);
	if (res.ok) throw new Error("unreachable");
	expect(res.message).toContain("Two copies of React");
	expect(res.message).toContain("1900.0.0");
	expect(res.message).toContain("1903.0.0");
	expect(res.message).toContain("bun install");
});
