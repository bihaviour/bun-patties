import { describe, expect, test } from "bun:test";
import { PattiesConfigSchema } from "../../src/config/schema.ts";

describe("PattiesConfigSchema", () => {
	test("missing input → all defaults populated", () => {
		const parsed = PattiesConfigSchema.parse({});
		expect(parsed.target).toBe("bun");
		expect(parsed.appDir).toBe("./app");
		expect(parsed.outDir).toBe("./.patties");
		expect(parsed.plugins).toEqual([]);
		expect(parsed.env).toEqual({ required: [], public: [] });
		expect(parsed.secrets).toEqual([]);
		expect(parsed.server.port).toBe(3000);
		expect(parsed.server.hostname).toBe("0.0.0.0");
		expect(parsed.adapter.bun.compile).toBe(false);
	});

	test("target: 'node' is rejected with field path in error", () => {
		const res = PattiesConfigSchema.safeParse({ target: "node" });
		expect(res.success).toBe(false);
		if (!res.success) {
			const issue = res.error.issues[0]!;
			expect(issue.path).toEqual(["target"]);
			expect(issue.message).toMatch(/bun/);
			expect(issue.message).toMatch(/edge/);
		}
	});

	test("full config round-trips", () => {
		const parsed = PattiesConfigSchema.parse({
			target: "edge",
			appDir: "./src",
			env: { required: ["DATABASE_URL"], public: ["PUBLIC_*"] },
			secrets: ["ANTHROPIC_API_KEY"],
			server: { port: 4000, hostname: "127.0.0.1", reusePort: true },
			adapter: { bun: { compile: true } },
		});
		expect(parsed.target).toBe("edge");
		expect(parsed.env.required).toEqual(["DATABASE_URL"]);
		expect(parsed.server.port).toBe(4000);
		expect(parsed.server.reusePort).toBe(true);
		expect(parsed.adapter.bun.compile).toBe(true);
	});
});
