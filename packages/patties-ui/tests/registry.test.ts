import { describe, expect, test } from "bun:test";
import { components } from "../src/registry.ts";

describe("registry", () => {
	test("every entry has a unique kebab-case name", () => {
		const names = components.map((c) => c.name);
		expect(new Set(names).size).toBe(names.length);
		for (const name of names) {
			expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
		}
	});

	test("every entry declares at least one file", () => {
		for (const c of components) {
			expect(c.files.length).toBeGreaterThan(0);
		}
	});
});
