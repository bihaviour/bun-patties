import { describe, expect, test } from "bun:test";
import { finalizeResponse } from "../src/middleware/cookies.ts";
import {
	compose,
	defineMiddleware,
	type Middleware,
	makeContext,
} from "../src/middleware/index.ts";
import { REQUEST_ID_RE } from "../src/middleware/request-id.ts";
import { createRenderer } from "../src/render/index.tsx";
import { createRouter } from "../src/router/index.ts";
import { createServer } from "../src/server/index.ts";

const FIXTURES = `${import.meta.dir}/fixtures`;
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withNodeEnv<T>(value: string | undefined, fn: () => T): T {
	const prev = process.env.NODE_ENV;
	if (value === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = value;
	try {
		return fn();
	} finally {
		if (prev === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = prev;
	}
}

describe("compose", () => {
	test("runs middleware in order then handler", async () => {
		const log: string[] = [];
		const m1: Middleware = async (_r, _c, next) => {
			log.push("a-in");
			const r = await next();
			log.push("a-out");
			return r;
		};
		const m2: Middleware = async (_r, _c, next) => {
			log.push("b-in");
			const r = await next();
			log.push("b-out");
			return r;
		};
		const h = (_r: Request) => new Response("hi");
		const composed = compose([m1, m2], h);
		const res = await composed(
			new Request("http://x/"),
			makeContext(new Request("http://x/")),
		);
		expect(await res.text()).toBe("hi");
		expect(log).toEqual(["a-in", "b-in", "b-out", "a-out"]);
	});

	test("identity defineMiddleware", () => {
		const m: Middleware = async (_r, _c, next) => next();
		expect(defineMiddleware(m)).toBe(m);
	});
});

describe("ctx.requestId (spec 19)", () => {
	test("generates a fresh id when no inbound header is present", () => {
		expect(REQUEST_ID_RE.test("0123abcd")).toBe(true);
		const ctx = makeContext(new Request("http://x/"));
		expect(ctx.requestId).toMatch(UUID_RE);
	});

	test("echoes a well-shaped inbound X-Request-Id", () => {
		const req = new Request("http://x/", {
			headers: { "x-request-id": "0123abcd" },
		});
		expect(makeContext(req).requestId).toBe("0123abcd");
	});

	test("ignores an inbound id that fails the allowlist", () => {
		const req = new Request("http://x/", {
			headers: { "x-request-id": "bad id with spaces" },
		});
		const ctx = makeContext(req);
		expect(ctx.requestId).not.toBe("bad id with spaces");
		expect(ctx.requestId).toMatch(UUID_RE);
	});
});

describe("finalizeResponse (specs 19 + 20)", () => {
	test("sets X-Request-Id from ctx", () => {
		const ctx = makeContext(new Request("http://x/"));
		const out = finalizeResponse(new Response("hi"), ctx, { startMs: 0 });
		expect(out.headers.get("X-Request-Id")).toBe(ctx.requestId);
	});

	test("never overwrites a handler-set X-Request-Id", () => {
		const ctx = makeContext(new Request("http://x/"));
		const res = new Response("hi", { headers: { "X-Request-Id": "custom" } });
		const out = finalizeResponse(res, ctx, { startMs: 0 });
		expect(out.headers.get("X-Request-Id")).toBe("custom");
	});

	test("adds Server-Timing in dev", () => {
		withNodeEnv("development", () => {
			const ctx = makeContext(new Request("http://x/"));
			const out = finalizeResponse(new Response("hi"), ctx, { startMs: 0 });
			expect(out.headers.get("Server-Timing") ?? "").toMatch(
				/^total;dur=\d+\.\d$/,
			);
		});
	});

	test("omits Server-Timing in production", () => {
		withNodeEnv("production", () => {
			const ctx = makeContext(new Request("http://x/"));
			const out = finalizeResponse(new Response("hi"), ctx, { startMs: 0 });
			expect(out.headers.has("Server-Timing")).toBe(false);
		});
	});

	test("never overwrites a handler-set Server-Timing", () => {
		withNodeEnv("development", () => {
			const ctx = makeContext(new Request("http://x/"));
			const res = new Response("hi", {
				headers: { "Server-Timing": "db;dur=5.0" },
			});
			const out = finalizeResponse(res, ctx, { startMs: 0 });
			expect(out.headers.get("Server-Timing")).toBe("db;dur=5.0");
		});
	});
});

describe("router middleware loading", () => {
	test("fires once per request including 404", async () => {
		const mod = (await import(`${FIXTURES}/basic-app/app/middleware.ts`)) as {
			__resetCount: () => void;
			__getCount: () => number;
		};
		mod.__resetCount();

		const renderer = createRenderer({});
		const { routes, fallback } = await createRouter({
			appDir: `${FIXTURES}/basic-app/app`,
			renderer,
		});
		const server = createServer({ routes, fallback });

		await server.fetch(new Request("http://localhost/"));
		await server.fetch(new Request("http://localhost/api/revenue"));
		await server.fetch(new Request("http://localhost/does-not-exist"));

		expect(mod.__getCount()).toBe(3);
	});

	test("missing middleware.ts boots silently", async () => {
		const renderer = createRenderer({});
		const compiled = await createRouter({
			appDir: `${FIXTURES}/no-middleware-app/app`,
			renderer,
		});
		expect(compiled.entries.length).toBeGreaterThan(0);
	});

	test("non-function default export throws with file path", async () => {
		const renderer = createRenderer({});
		let err: Error | null = null;
		try {
			await createRouter({
				appDir: `${FIXTURES}/bad-middleware-app/app`,
				renderer,
			});
		} catch (e) {
			err = e as Error;
		}
		expect(err).not.toBeNull();
		expect(err?.message).toContain("middleware.ts");
	});
});
