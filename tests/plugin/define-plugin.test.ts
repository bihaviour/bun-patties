import { describe, expect, test } from "bun:test";
import { definePlugin } from "../../src/plugin/index.ts";

describe("definePlugin", () => {
	test("returns the plugin as-is", () => {
		const p = definePlugin({ name: "x", setup: () => {} });
		expect(p.name).toBe("x");
		expect(typeof p.setup).toBe("function");
	});

	test("throws when name missing", () => {
		expect(() => definePlugin({} as never)).toThrow(/name/);
	});
});
