import { describe, expect, test } from "bun:test";
import { components } from "../src/registry.ts";
import { ComponentEntrySchema } from "../src/schema.ts";

describe("schema", () => {
	test("every shipped catalog entry validates against ComponentEntrySchema", () => {
		for (const entry of components) {
			const parsed = ComponentEntrySchema.safeParse(entry);
			if (!parsed.success) {
				throw new Error(
					`${entry.name} failed: ${parsed.error.issues
						.map((i) => `${i.path.join(".")}: ${i.message}`)
						.join("; ")}`,
				);
			}
			expect(parsed.success).toBe(true);
		}
	});

	test("rejects an unknown key (strict)", () => {
		const bad = { ...components[0], surprise: true };
		expect(ComponentEntrySchema.safeParse(bad).success).toBe(false);
	});

	test("rejects an invalid island value", () => {
		const bad = { ...components[0], island: "maybe" };
		expect(ComponentEntrySchema.safeParse(bad).success).toBe(false);
	});
});
