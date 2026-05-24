import { afterEach, describe, expect, test } from "bun:test";
import { __resetRegistry, registerAgent } from "../../src/ai/registry.ts";
import { registerAgentTriggers } from "../../src/ai/triggers.ts";
import type { BunRoutes, RouteEntry } from "../../src/types.ts";

afterEach(() => __resetRegistry());

describe("agent triggers", () => {
	test("wires synthetic route when no FS route claims the path", () => {
		registerAgent({ name: "x", model: "m", triggers: ["POST /api/x/chat"] });
		const routes: BunRoutes = {};
		const entries: RouteEntry[] = [];
		registerAgentTriggers(routes, entries);
		const at = routes["/api/x/chat"] as Record<string, unknown> | undefined;
		expect(at).toBeDefined();
		expect(typeof at!.POST).toBe("function");
	});

	test("skips and warns when a FS route claims the path", () => {
		registerAgent({ name: "y", model: "m", triggers: ["POST /api/y/chat"] });
		const routes: BunRoutes = {};
		const entries: RouteEntry[] = [
			{
				filePath: "/x/api/y/chat.ts",
				bunPattern: "/api/y/chat",
				kind: "api",
				segments: [],
			},
		];
		const warns: string[] = [];
		const orig = console.warn;
		console.warn = (...args: unknown[]) =>
			warns.push(args.map(String).join(" "));
		try {
			registerAgentTriggers(routes, entries);
		} finally {
			console.warn = orig;
		}
		expect(routes["/api/y/chat"]).toBeUndefined();
		expect(warns.some((w) => /trigger conflict/.test(w))).toBe(true);
	});

	test("invalid trigger format warns + skips", () => {
		registerAgent({
			name: "z",
			model: "m",
			triggers: ["totally-bad"] as never,
		});
		const routes: BunRoutes = {};
		const warns: string[] = [];
		const orig = console.warn;
		console.warn = (...args: unknown[]) =>
			warns.push(args.map(String).join(" "));
		try {
			registerAgentTriggers(routes, []);
		} finally {
			console.warn = orig;
		}
		expect(Object.keys(routes)).toHaveLength(0);
		expect(warns.some((w) => /invalid trigger/.test(w))).toBe(true);
	});
});
