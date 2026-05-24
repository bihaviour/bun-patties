import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";
import { startServer } from "../../src/server/index.ts";

const FIXTURES = join(import.meta.dir, "..", "fixtures");

type LiveServer = { port: number; stop: (closeActive?: boolean) => void };

async function boot(appDir: string): Promise<LiveServer> {
	const renderer = createRenderer({});
	const { routes, fallback } = await createRouter({ appDir, renderer });
	return startServer({
		routes,
		fallback,
		port: 0,
		hostname: "127.0.0.1",
	}) as unknown as LiveServer;
}

const base = (s: LiveServer): string => `http://127.0.0.1:${s.port}`;

describe("spec 07 — middleware via real Bun.serve", () => {
	describe("basic-app: logging + 404 pass-through", () => {
		let server: LiveServer;
		let counter: { __getCount: () => number; __resetCount: () => void };

		beforeAll(async () => {
			counter = (await import(
				join(FIXTURES, "basic-app/app/middleware.ts")
			)) as typeof counter;
			server = await boot(join(FIXTURES, "basic-app/app"));
		});
		afterAll(() => server.stop(true));

		test("middleware fires once per request, including 404", async () => {
			counter.__resetCount();
			const r1 = await fetch(`${base(server)}/`);
			const r2 = await fetch(`${base(server)}/api/revenue`);
			const r3 = await fetch(`${base(server)}/does-not-exist`);
			// Drain bodies so Bun closes the sockets cleanly.
			await Promise.all([r1.text(), r2.text(), r3.text()]);

			expect(r1.status).toBe(200);
			expect(r2.status).toBe(200);
			expect(r3.status).toBe(404);
			expect(counter.__getCount()).toBe(3);
		});
	});

	describe("cookie-app: ctx.cookies flush without explicit serialization", () => {
		let server: LiveServer;
		beforeAll(async () => {
			server = await boot(join(FIXTURES, "cookie-app/app"));
		});
		afterAll(() => server.stop(true));

		test("middleware ctx.cookies.set emits Set-Cookie on a page route", async () => {
			const res = await fetch(`${base(server)}/`);
			await res.text();
			const setCookie = res.headers.get("set-cookie") ?? "";
			expect(setCookie).toContain("sid=abc");
		});

		test("middleware ctx.cookies.set also flushes on the 404 fallback path", async () => {
			const res = await fetch(`${base(server)}/no-such-route`);
			await res.text();
			expect(res.status).toBe(404);
			const setCookie = res.headers.get("set-cookie") ?? "";
			expect(setCookie).toContain("sid=abc");
		});

		test("ctx.cookies.get reads the inbound Cookie header", async () => {
			const res = await fetch(`${base(server)}/api/echo?name=flavor`, {
				headers: { cookie: "flavor=mint" },
			});
			const body = (await res.json()) as { name: string; value: string | null };
			expect(body.value).toBe("mint");
		});
	});

	describe("no-middleware-app: boots silently", () => {
		let server: LiveServer;
		beforeAll(async () => {
			server = await boot(join(FIXTURES, "no-middleware-app/app"));
		});
		afterAll(() => server.stop(true));

		test("serves routes without any middleware wired", async () => {
			const res = await fetch(`${base(server)}/`);
			expect(res.status).toBe(200);
			await res.text();
		});
	});

	describe("bad-middleware-app: throws at boot", () => {
		test("non-function default export is rejected with the file path in the message", async () => {
			let err: Error | null = null;
			try {
				await boot(join(FIXTURES, "bad-middleware-app/app"));
			} catch (e) {
				err = e as Error;
			}
			expect(err).not.toBeNull();
			expect(err!.message).toContain("middleware.ts");
		});
	});
});
