import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { build } from "../../src/build/index.ts";

const FIXTURES = join(import.meta.dir, "..", "fixtures");

// Spec 04 forbids `node:fs/promises` in framework code. Tests follow the same
// rule; mktemp/rm go through Bun.$ instead.
async function makeOut(): Promise<string> {
	const out = (await Bun.$`mktemp -d -t patties-build.XXXXXX`.text()).trim();
	return out;
}

const created: string[] = [];

afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
	// gen dirs land inside fixtures — clean them too.
	for (const f of ["build-app", "no-middleware-app"]) {
		await Bun.$`rm -rf ${join(FIXTURES, f, "app", "patties-gen")}`.quiet();
	}
});

test("zero-island project produces empty client manifest and no client files", async () => {
	const outDir = await makeOut();
	created.push(outDir);

	const res = await build({
		appDir: join(FIXTURES, "no-middleware-app/app"),
		outDir,
		target: "bun",
		mode: "production",
	});

	expect(res.clientManifest.entry).toBeNull();
	expect(Object.keys(res.clientManifest.islands)).toHaveLength(0);

	const glob = new Bun.Glob("**/*.{js,mjs}");
	const found: string[] = [];
	try {
		for await (const f of glob.scan({
			cwd: join(outDir, "client"),
			onlyFiles: true,
		})) {
			found.push(f);
		}
	} catch {
		// dir absent for zero-island case — that's fine
	}
	expect(found).toHaveLength(0);
});

test("one-island project emits an entry chunk and registers the island", async () => {
	const outDir = await makeOut();
	created.push(outDir);

	const res = await build({
		appDir: join(FIXTURES, "build-app/app"),
		outDir,
		target: "bun",
		mode: "production",
	});

	expect(res.clientManifest.entry).toBeString();
	expect(res.clientManifest.entry?.startsWith("/_patties/client/")).toBeTrue();
	expect(res.clientManifest.islands.counter).toBeString();
	expect(
		res.clientManifest.islands.counter?.startsWith("/_patties/client/"),
	).toBeTrue();

	// Spec acceptance: "exactly one chunk" for a single-island project.
	const glob = new Bun.Glob("**/*.js");
	let count = 0;
	for await (const _ of glob.scan({
		cwd: join(outDir, "client"),
		onlyFiles: true,
	}))
		count++;
	expect(count).toBe(1);
});

test("server bundle contains inlined route table and no runtime filesystem scan", async () => {
	const outDir = await makeOut();
	created.push(outDir);

	const res = await build({
		appDir: join(FIXTURES, "build-app/app"),
		outDir,
		target: "bun",
		mode: "production",
	});

	const source = await Bun.file(res.serverEntry).text();
	// Bun.build unquotes JSON object keys when bundling — accept either form.
	expect(source).toMatch(
		/bunPattern:\s*"\/api\/ping"|"bunPattern":\s*"\/api\/ping"/,
	);
	expect(source).not.toContain("Bun.Glob");
	expect(source).not.toMatch(/\bscanRoutes\s*\(/);
});

test("public assets are copied with content preserved", async () => {
	const outDir = await makeOut();
	created.push(outDir);

	const res = await build({
		appDir: join(FIXTURES, "build-app/app"),
		outDir,
		target: "bun",
		mode: "production",
	});

	const robots = res.assets.find((a) => a.src.endsWith("/robots.txt"));
	expect(robots).toBeDefined();
	if (!robots) throw new Error("robots.txt asset missing");
	const copied = await Bun.file(robots.dest).text();
	const original = await Bun.file(
		join(FIXTURES, "build-app/app/public/robots.txt"),
	).text();
	expect(copied).toBe(original);
});

test("edge target emits a `export default { fetch }` worker module", async () => {
	const outDir = await makeOut();
	created.push(outDir);

	const res = await build({
		appDir: join(FIXTURES, "build-app/app"),
		outDir,
		target: "edge",
		mode: "production",
	});

	const source = await Bun.file(res.serverEntry).text();
	expect(source).toMatch(
		/export\s*\{[^}]*\s+as\s+default\s*\}|export\s+default\s*\{/,
	);
	expect(source).toContain("fetch");
});

test.skipIf(process.platform === "win32")(
	"bun.compile produces a single standalone executable",
	async () => {
		const outDir = await makeOut();
		created.push(outDir);

		const res = await build({
			appDir: join(FIXTURES, "build-app/app"),
			outDir,
			target: "bun",
			mode: "production",
			compile: true,
		});

		const f = Bun.file(res.serverEntry);
		expect(await f.exists()).toBeTrue();
		// A `bun build --compile` binary embeds the Bun runtime — well over 1MB.
		expect(f.size).toBeGreaterThan(1_000_000);
	},
	300_000,
);
