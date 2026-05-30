import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createDevServer } from "../../src/dev/watcher.ts";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";
import { startServer } from "../../src/server/index.ts";

const FIXTURES = join(import.meta.dir, "..", "fixtures");

type LiveServer = { port: number; stop: (closeActive?: boolean) => void };

describe("spec 05 — dev routes wired through startServer", () => {
	let server: LiveServer;
	const appDir = join(FIXTURES, "basic-app/app");

	beforeAll(async () => {
		const renderer = createRenderer({ dev: true });
		const { routes, fallback } = await createRouter({ appDir, renderer });
		const devServer = createDevServer({ appDir });
		server = startServer({
			routes,
			fallback,
			dev: true,
			devServer,
			port: 0,
			hostname: "127.0.0.1",
		}) as unknown as LiveServer;
	});
	afterAll(() => server.stop(true));

	test("/__patties_hmr without Upgrade header returns 426", async () => {
		const res = await fetch(`http://127.0.0.1:${server.port}/__patties_hmr`);
		await res.text();
		expect(res.status).toBe(426);
	});

	test("/__patties_open without ?file returns 400", async () => {
		const res = await fetch(`http://127.0.0.1:${server.port}/__patties_open`);
		await res.text();
		expect(res.status).toBe(400);
	});

	test("/__patties_hmr accepts a WebSocket upgrade and receives initial hello", async () => {
		const ws = new WebSocket(`ws://127.0.0.1:${server.port}/__patties_hmr`);
		const msg = await new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("ws timeout")), 2000);
			ws.addEventListener("message", (e) => {
				clearTimeout(timer);
				resolve(String(e.data));
			});
			ws.addEventListener("error", () => {
				clearTimeout(timer);
				reject(new Error("ws error"));
			});
		});
		ws.close();
		const parsed = JSON.parse(msg) as { type: string; serverId: string };
		expect(parsed.type).toBe("hello");
		expect(typeof parsed.serverId).toBe("string");
		expect(parsed.serverId.length).toBeGreaterThan(0);
	});

	test("ordinary routes still serve in dev mode", async () => {
		const res = await fetch(`http://127.0.0.1:${server.port}/`);
		expect(res.status).toBe(200);
		await res.text();
	});
});
