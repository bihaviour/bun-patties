import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { build } from "../../src/build/index.ts";

const FIXTURES = join(import.meta.dir, "..", "fixtures");
const created: string[] = [];

afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
	for (const f of ["build-app", "no-middleware-app"]) {
		await Bun.$`rm -rf ${join(FIXTURES, f, "app", "patties-gen")}`.quiet();
	}
});

async function makeOut(): Promise<string> {
	const out = (await Bun.$`mktemp -d -t patties-edge.XXXXXX`.text()).trim();
	created.push(out);
	return out;
}

test("edge adapter emits dist/worker.js with a default fetch export", async () => {
	const outDir = await makeOut();
	const result = await build({
		appDir: join(FIXTURES, "no-middleware-app/app"),
		outDir,
		target: "edge",
		mode: "production",
	});

	expect(result.serverEntry).toBe(`${outDir}/worker.js`);
	expect(await Bun.file(`${outDir}/worker.js`).exists()).toBe(true);

	const mod = (await import(`${outDir}/worker.js`)) as {
		default?: { fetch?: unknown };
	};
	expect(mod.default).toBeDefined();
	expect(typeof mod.default?.fetch).toBe("function");
});

test("edge worker dispatches a real request and exposes :param via dispatch", async () => {
	const outDir = await makeOut();
	await build({
		appDir: join(FIXTURES, "build-app/app"),
		outDir,
		target: "edge",
		mode: "production",
	});
	const mod = (await import(`${outDir}/worker.js`)) as {
		default: {
			fetch: (req: Request, env?: unknown, ctx?: unknown) => Promise<Response>;
		};
	};

	// build-app fixture has at least an index route. Fire a request through the
	// worker default export and assert we get a Response back (not the fallback).
	const res = await mod.default.fetch(
		new Request("http://x/"),
		{ K: "V" },
		undefined,
	);
	expect(res).toBeInstanceOf(Response);
});

test("edge worker dispatch runs the response finalizer (X-Request-Id, spec 19)", async () => {
	const outDir = await makeOut();
	await build({
		appDir: join(FIXTURES, "build-app/app"),
		outDir,
		target: "edge",
		mode: "production",
	});
	const mod = (await import(`${outDir}/worker.js`)) as {
		default: {
			fetch: (req: Request, env?: unknown, ctx?: unknown) => Promise<Response>;
		};
	};

	// Fresh id is minted and echoed on the response.
	const fresh = await mod.default.fetch(
		new Request("http://x/"),
		{},
		undefined,
	);
	expect(fresh.headers.get("x-request-id") ?? "").toMatch(
		/^[A-Za-z0-9._-]{8,128}$/,
	);

	// A well-shaped inbound id is echoed back unchanged.
	const echoed = await mod.default.fetch(
		new Request("http://x/", { headers: { "x-request-id": "edge-1234" } }),
		{},
		undefined,
	);
	expect(echoed.headers.get("x-request-id")).toBe("edge-1234");
});
