import { describe, expect, test } from "bun:test";
import { definePlugin } from "../../src/plugin/index.ts";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";
import { createServer } from "../../src/server/index.ts";

const FIXTURES = `${import.meta.dir}/../fixtures`;

describe("plugin route registration", () => {
	test("server.route attaches a reachable route wrapped by user middleware", async () => {
		const seen: string[] = [];
		const plugin = definePlugin({
			name: "health",
			setup(server) {
				server.route("/__health", {
					GET: () => new Response("ok"),
				});
				server.use(async (_req, _ctx, next) => {
					seen.push("plugin-mw");
					return next();
				});
			},
		});
		const renderer = createRenderer({});
		const { routes, fallback } = await createRouter({
			appDir: `${FIXTURES}/basic-app/app`,
			renderer,
			plugins: [plugin],
		});
		const server = createServer({ routes, fallback });
		const res = await server.fetch(new Request("http://localhost/__health"));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
		expect(seen).toContain("plugin-mw");
	});

	test("setup error names the plugin", async () => {
		const plugin = definePlugin({
			name: "broken",
			setup() {
				throw new Error("boom");
			},
		});
		const renderer = createRenderer({});
		await expect(
			createRouter({
				appDir: `${FIXTURES}/basic-app/app`,
				renderer,
				plugins: [plugin],
			}),
		).rejects.toThrow(/\[plugin broken\]/);
	});
});
