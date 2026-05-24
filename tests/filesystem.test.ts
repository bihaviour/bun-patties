import { describe, expect, test } from "bun:test";
import { scanRoutes } from "../src/router/filesystem.ts";

const FIXTURES = `${import.meta.dir}/fixtures`;

describe("scanRoutes", () => {
	test("empty routes/ returns []", async () => {
		const out = await scanRoutes(`${FIXTURES}/empty-app/app`);
		expect(out).toEqual([]);
	});

	test("conflict raises clear error naming both files", async () => {
		let err: Error | null = null;
		try {
			await scanRoutes(`${FIXTURES}/conflict-app/app`);
		} catch (e) {
			err = e as Error;
		}
		expect(err).not.toBeNull();
		expect(err?.message).toContain("[id].tsx");
		expect(err?.message).toContain("[id]/index.tsx");
		expect(err?.message).toMatch(/Route conflict/i);
	});

	test("stable + correct patterns for basic-app", async () => {
		const a = await scanRoutes(`${FIXTURES}/basic-app/app`);
		const b = await scanRoutes(`${FIXTURES}/basic-app/app`);
		expect(a.map((e) => e.bunPattern)).toEqual(b.map((e) => e.bunPattern));

		const byPattern = Object.fromEntries(a.map((e) => [e.bunPattern, e.kind]));
		expect(byPattern["/"]).toBe("page");
		expect(byPattern["/about"]).toBe("page");
		expect(byPattern["/hotels/:city"]).toBe("page");
		expect(byPattern["/api/revenue"]).toBe("api");
	});
});
