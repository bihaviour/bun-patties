import { describe, expect, test } from "bun:test";
import {
	hasScatteredRadix,
	rewriteRadix,
} from "../../src/cli/commands/ui/migrate/radix.ts";

describe("rewriteRadix", () => {
	test("rewrites a namespace import to the unified radix-ui form", () => {
		const src = `import * as Dialog from "@radix-ui/react-dialog";\n`;
		const r = rewriteRadix(src);
		expect(r.changed).toBe(true);
		expect(r.output).toBe(`import { Dialog } from "radix-ui";\n`);
	});

	test("keeps the local alias when it differs from the namespace", () => {
		const src = `import * as DialogPrimitive from "@radix-ui/react-dialog";\n`;
		const r = rewriteRadix(src);
		expect(r.output).toContain(
			`import { Dialog as DialogPrimitive } from "radix-ui";`,
		);
	});

	test("PascalCases multi-word packages", () => {
		const src = `import * as P from "@radix-ui/react-alert-dialog";\n`;
		expect(rewriteRadix(src).output).toContain(`AlertDialog as P`);
	});

	test("merges multiple scattered imports into one statement", () => {
		const src = [
			`import * as Dialog from "@radix-ui/react-dialog";`,
			`import * as Tabs from "@radix-ui/react-tabs";`,
			`export const x = 1;`,
			"",
		].join("\n");
		const r = rewriteRadix(src);
		const importLines = r.output
			.split("\n")
			.filter((l) => l.includes("radix-ui"));
		expect(importLines).toHaveLength(1);
		expect(importLines[0]).toContain("Dialog");
		expect(importLines[0]).toContain("Tabs");
		expect(r.output).toContain("export const x = 1;");
	});

	test("is idempotent — already-unified source is unchanged", () => {
		const src = `import { Dialog } from "radix-ui";\n`;
		const r = rewriteRadix(src);
		expect(r.changed).toBe(false);
		expect(r.output).toBe(src);
	});

	test("no radix import at all is a no-op", () => {
		const src = `import { useState } from "react";\n`;
		expect(rewriteRadix(src).changed).toBe(false);
	});

	test("named imports with no unified equivalent are reported, not rewritten", () => {
		const src = `import { Foo } from "@radix-ui/react-dialog";\n`;
		const r = rewriteRadix(src);
		expect(r.changed).toBe(false);
		expect(r.reports.length).toBeGreaterThan(0);
	});

	test("hasScatteredRadix detects the package", () => {
		expect(hasScatteredRadix(`from "@radix-ui/react-tabs"`)).toBe(true);
		expect(hasScatteredRadix(`from "radix-ui"`)).toBe(false);
	});
});
