import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { build } from "../../src/build/index.ts";
import { NAV_HEADER } from "../../src/render/bootstrap.ts";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";

const APP = join(import.meta.dir, "..", "fixtures", "hydrate-app", "app");
const created: string[] = [];

afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
	await Bun.$`rm -rf ${join(APP, "patties-gen")}`.quiet();
});

async function makeOut(): Promise<string> {
	const out = (await Bun.$`mktemp -d -t patties-hydrate.XXXXXX`.text()).trim();
	created.push(out);
	return out;
}

async function readClient(outDir: string): Promise<string> {
	let all = "";
	const glob = new Bun.Glob("**/*.js");
	for await (const f of glob.scan({ cwd: join(outDir, "client") })) {
		all += await Bun.file(join(outDir, "client", f)).text();
	}
	return all;
}

type Built = Awaited<ReturnType<typeof build>>;
let bunBuild: Built;
let bunOut: string;

beforeAll(async () => {
	bunOut = await makeOut();
	bunBuild = await build({
		appDir: APP,
		outDir: bunOut,
		target: "bun",
		mode: "production",
	});
});

describe("build", () => {
	test("bundles only routes that export hydrate = true", () => {
		const pages = bunBuild.clientManifest.pages;
		expect(Object.keys(pages).sort()).toEqual(["/", "/users/:id"]);
		expect(pages["/"]?.startsWith("/_patties/client/")).toBeTrue();
		expect(pages["/static"]).toBeUndefined();
		// No islands in the fixture, so there is no island entry either.
		expect(bunBuild.clientManifest.entry).toBeNull();
		expect(bunBuild.counts.hydratedPages).toBe(2);
	});

	test("strips loader/serialize and their server-only imports from the client", async () => {
		const client = await readClient(bunOut);
		expect(client).not.toContain("patties-server-only-marker");
		expect(client).not.toContain("toISOString");
		// deserialize is a client hook and must survive.
		expect(client).toContain("getUTCFullYear");
	});

	test("ships React's production build", async () => {
		const client = await readClient(bunOut);
		expect(client).not.toContain("react-dom.development");
		expect(client).not.toContain("Warning: ");
	});

	test("reports per-route client bytes including shared chunks", async () => {
		const bytes = bunBuild.clientBytes;
		const userUrl = bunBuild.clientManifest.pages["/users/:id"] ?? "";
		const entryOnly = Bun.file(
			join(bunOut, "client", userUrl.split("/").pop() ?? ""),
		).size;
		expect(bytes["/users/:id"]).toBeGreaterThan(entryOnly);
		expect(bytes["/"]).toBeGreaterThan(0);
		expect(bytes["/static"]).toBeUndefined();
	});

	test("server bundle performs no runtime route scan", async () => {
		const source = await Bun.file(bunBuild.serverEntry).text();
		expect(source).not.toContain("Bun.Glob");
		expect(source).not.toMatch(/\bscanRoutes\s*\(/);
	});

	test("render.hydrate = pages hydrates every page route by default", async () => {
		const out = await makeOut();
		const res = await build({
			appDir: APP,
			outDir: out,
			target: "bun",
			mode: "production",
			hydrate: "pages",
		});
		expect(Object.keys(res.clientManifest.pages).sort()).toEqual([
			"/",
			"/static",
			"/users/:id",
		]);
	});
});

describe("render", () => {
	async function handler() {
		const renderer = createRenderer({ manifest: bunBuild.clientManifest });
		const router = await createRouter({ appDir: APP, renderer });
		return (path: string, headers: Record<string, string> = {}) => {
			const route = router.routes[path === "/users/7" ? "/users/:id" : path];
			const fn = (route as Record<string, (r: Request) => Promise<Response>>)
				.GET;
			const req = Object.assign(
				new Request(`http://x${path}`, { headers }),
				path === "/users/7" ? { params: { id: "7" } } : { params: {} },
			);
			if (!fn) throw new Error(`no GET for ${path}`);
			return fn(req);
		};
	}

	test("hydrated page emits the bootstrap payload and its page chunk", async () => {
		const get = await handler();
		const res = await get("/");
		const html = await res.text();
		expect(res.headers.get("vary")).toBe(NAV_HEADER);
		expect(html).toContain(
			'<script type="application/json" id="__patties_bootstrap">{"params":{},"data":{"start":3,"at":"2026-01-02T03:04:05.000Z"}}</script>',
		);
		expect(html).toContain(
			`<script type="module" src="${bunBuild.clientManifest.pages["/"]}">`,
		);
		expect(html).toContain("count: <!-- -->3");
	});

	test("params-only bootstrap for a page without a loader", async () => {
		const get = await handler();
		const html = await (await get("/users/7")).text();
		expect(html).toContain('{"params":{"id":"7"}}');
	});

	test("non-hydrated routes still ship zero client JS", async () => {
		const get = await handler();
		const html = await (await get("/static")).text();
		expect(html).not.toContain("<script");
	});

	test("nav request returns the JSON payload for a hydrated route", async () => {
		const get = await handler();
		const res = await get("/", { [NAV_HEADER]: "1" });
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(await res.json()).toEqual({
			hydrated: true,
			route: "/",
			script: bunBuild.clientManifest.pages["/"],
			bootstrap: {
				params: {},
				data: { start: 3, at: "2026-01-02T03:04:05.000Z" },
			},
			title: "Hydrated Home",
		});
	});

	test("nav request to a non-hydrated route asks for a full load", async () => {
		const get = await handler();
		const res = await get("/static", { [NAV_HEADER]: "1" });
		expect(await res.json()).toEqual({ hydrated: false });
	});
});

describe("edge target", () => {
	test("worker serves the same bootstrap and nav payload", async () => {
		const out = await makeOut();
		const res = await build({
			appDir: APP,
			outDir: out,
			target: "edge",
			mode: "production",
		});
		const mod = (await import(res.serverEntry)) as {
			default: { fetch: (req: Request) => Promise<Response> };
		};
		const html = await (
			await mod.default.fetch(new Request("http://x/users/42"))
		).text();
		expect(html).toContain('{"params":{"id":"42"}}');
		expect(html).toContain(res.clientManifest.pages["/users/:id"] ?? "!");

		const nav = await mod.default.fetch(
			new Request("http://x/", { headers: { [NAV_HEADER]: "1" } }),
		);
		const payload = (await nav.json()) as { hydrated: boolean; title: string };
		expect(payload.hydrated).toBeTrue();
		expect(payload.title).toBe("Hydrated Home");
	});
});
