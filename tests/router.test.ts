import { describe, expect, test } from "bun:test";
import { createRenderer } from "../src/render/index.tsx";
import { createRouter } from "../src/router/index.ts";
import { createServer } from "../src/server/index.ts";

const FIXTURES = import.meta.dir + "/fixtures";

async function buildBasic() {
	const renderer = createRenderer({});
	const { routes, fallback } = await createRouter({
		appDir: FIXTURES + "/basic-app/app",
		renderer,
	});
	return createServer({ routes, fallback });
}

describe("router", () => {
	test("GET / renders index", async () => {
		const server = await buildBasic();
		const res = await server.fetch(new Request("http://localhost/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("text/html");
		const body = await res.text();
		expect(body).toContain("hello from index");
		expect(body.startsWith("<!DOCTYPE html>")).toBe(true);
	});

	test("GET /hotels/bali populates ctx.params.city", async () => {
		const server = await buildBasic();
		const res = await server.fetch(new Request("http://localhost/hotels/bali"));
		expect(res.status).toBe(200);
		const body = await res.text();
		// React inserts a comment between text + expression; collapse for the check.
		expect(body.replace(/<!--.*?-->/g, "")).toContain("City: bali");
	});

	test("GET /api/revenue invokes exported GET through middleware", async () => {
		const server = await buildBasic();
		const res = await server.fetch(new Request("http://localhost/api/revenue"));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { ok: boolean; mw: string | null };
		expect(json.ok).toBe(true);
		expect(json.mw).toBe("ran");
	});

	test("POST on GET-only API returns 405", async () => {
		const server = await buildBasic();
		const res = await server.fetch(
			new Request("http://localhost/api/revenue", { method: "POST" }),
		);
		expect(res.status).toBe(405);
	});

	test("404 fallback", async () => {
		const server = await buildBasic();
		const res = await server.fetch(new Request("http://localhost/nope"));
		expect(res.status).toBe(404);
	});
});
