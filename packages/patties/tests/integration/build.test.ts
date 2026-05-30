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
	"bun.compile embeds assets + chunks and serves them with no dist sidecar",
	async () => {
		const outDir = await makeOut();
		created.push(outDir);
		const port = 41000 + Math.floor(Math.random() * 2000);

		const res = await build({
			appDir: join(FIXTURES, "build-app/app"),
			outDir,
			target: "bun",
			mode: "production",
			compile: true,
			port,
		});

		const f = Bun.file(res.serverEntry);
		expect(await f.exists()).toBeTrue();
		// A `bun build --compile` binary embeds the Bun runtime — well over 1MB.
		expect(f.size).toBeGreaterThan(1_000_000);
		// Single-file deploy: no dist/assets sidecar.
		expect(
			await Bun.file(join(outDir, "assets/robots.txt")).exists(),
		).toBeFalse();

		// Run the binary from an EMPTY cwd so disk reads cannot satisfy assets —
		// everything served must come from the embedded-files table.
		const runDir = await makeOut();
		created.push(runDir);
		const proc = Bun.spawn({
			cmd: [res.serverEntry],
			cwd: runDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		try {
			const baseUrl = `http://localhost:${port}`;
			let up = false;
			for (let i = 0; i < 100; i++) {
				try {
					await fetch(`${baseUrl}/_patties/assets/robots.txt`);
					up = true;
					break;
				} catch {
					await Bun.sleep(100);
				}
			}
			if (!up) {
				throw new Error(
					`binary never bound :${port}\n${await new Response(proc.stderr).text()}`,
				);
			}

			const robotsRes = await fetch(`${baseUrl}/_patties/assets/robots.txt`);
			expect(robotsRes.status).toBe(200);
			const original = await Bun.file(
				join(FIXTURES, "build-app/app/public/robots.txt"),
			).text();
			expect(await robotsRes.text()).toBe(original);

			const chunkUrl = res.clientManifest.entry;
			expect(chunkUrl).toBeString();
			const chunkRes = await fetch(`${baseUrl}${chunkUrl}`);
			expect(chunkRes.status).toBe(200);
			expect((await chunkRes.text()).length).toBeGreaterThan(0);
		} finally {
			proc.kill();
			await proc.exited;
		}
	},
	300_000,
);

test("edge + compile is a build error", async () => {
	const outDir = await makeOut();
	created.push(outDir);
	await expect(
		build({
			appDir: join(FIXTURES, "build-app/app"),
			outDir,
			target: "edge",
			mode: "production",
			compile: true,
		}),
	).rejects.toThrow(/only supported with target "bun"/);
});
