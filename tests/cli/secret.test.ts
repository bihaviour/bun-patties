import { expect, test } from "bun:test";
import { runSecret } from "../../src/cli/commands/secret.ts";

test("production env blocks set/get/list/rm", async () => {
	const prev = process.env.PATTIES_ENV;
	process.env.PATTIES_ENV = "production";
	try {
		for (const sub of ["set", "get", "list", "rm"]) {
			const code = await runSecret([sub, "FOO"], {
				cwd: process.cwd(),
				verbose: false,
			});
			expect(code).toBe(2);
		}
	} finally {
		if (prev === undefined) delete process.env.PATTIES_ENV;
		else process.env.PATTIES_ENV = prev;
	}
});

test("doctor runs in production without crashing", async () => {
	const prev = process.env.PATTIES_ENV;
	process.env.PATTIES_ENV = "production";
	try {
		const code = await runSecret(["doctor"], {
			cwd: process.cwd(),
			verbose: false,
		});
		expect([0, 1]).toContain(code);
	} finally {
		if (prev === undefined) delete process.env.PATTIES_ENV;
		else process.env.PATTIES_ENV = prev;
	}
});

test("help when no subcommand", async () => {
	const code = await runSecret([], { cwd: process.cwd(), verbose: false });
	expect(code).toBe(0);
});
