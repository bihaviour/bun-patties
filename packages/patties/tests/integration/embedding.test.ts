import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";
import type { BunRoutes } from "../../src/types.ts";

// The documented embedding contract (pages/docs/server.html#embedding): a host
// `Bun.serve` spreads `createRouter()`'s routes next to its own, and Bun's
// router — not object order — decides between different patterns.
const APP = join(import.meta.dir, "..", "fixtures", "basic-app", "app");

let server: ReturnType<typeof Bun.serve>;
const url = (p: string) => `http://localhost:${server.port}${p}`;

beforeAll(async () => {
	const router = await createRouter({
		appDir: APP,
		renderer: createRenderer(),
	});
	const host: BunRoutes = {
		"/hotels/featured": () => new Response("host exact"),
		"/oauth/*": () => new Response("host wildcard"),
		"/about": { POST: () => new Response("host about POST") },
	};
	server = Bun.serve({
		port: 0,
		routes: { ...host, ...router.routes },
		fetch: router.fallback,
	});
});

afterAll(() => {
	server.stop(true);
});

test("a more specific pattern wins regardless of which table defines it", async () => {
	expect(await (await fetch(url("/hotels/featured"))).text()).toBe(
		"host exact",
	);
	const page = await fetch(url("/hotels/bali"));
	expect(page.headers.get("content-type")).toContain("text/html");
	expect(await (await fetch(url("/oauth/callback"))).text()).toBe(
		"host wildcard",
	);
});

test("an identical pattern is replaced wholesale by the table spread last", async () => {
	expect((await fetch(url("/about"))).status).toBe(200);
	// The host's POST handler lived on the same key and is gone.
	expect((await fetch(url("/about"), { method: "POST" })).status).toBe(404);
});

test("unmatched requests reach the Patties fallback", async () => {
	expect((await fetch(url("/definitely-not-here"))).status).toBe(404);
});
