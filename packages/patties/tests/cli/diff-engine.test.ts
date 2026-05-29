import { describe, expect, test } from "bun:test";
import {
	diffLines,
	formatUnifiedDiff,
	toHunks,
} from "../../src/cli/commands/add/diff.ts";

describe("diffLines", () => {
	test("identical input produces only eq ops", () => {
		const ops = diffLines("a\nb\nc", "a\nb\nc");
		expect(ops.every((o) => o.type === "eq")).toBe(true);
	});

	test("a single changed line yields one del + one add", () => {
		const ops = diffLines("a\nb\nc", "a\nB\nc");
		expect(ops.filter((o) => o.type === "del").map((o) => o.line)).toEqual([
			"b",
		]);
		expect(ops.filter((o) => o.type === "add").map((o) => o.line)).toEqual([
			"B",
		]);
	});

	test("pure insertion yields adds only", () => {
		const ops = diffLines("a\nc", "a\nb\nc");
		expect(ops.filter((o) => o.type === "add").map((o) => o.line)).toEqual([
			"b",
		]);
		expect(ops.some((o) => o.type === "del")).toBe(false);
	});
});

describe("toHunks", () => {
	test("no hunks when nothing changed", () => {
		expect(toHunks(diffLines("a\nb", "a\nb"))).toEqual([]);
	});

	test("one hunk for a localized change", () => {
		const hunks = toHunks(diffLines("a\nb\nc\nd\ne", "a\nb\nX\nd\ne"));
		expect(hunks.length).toBe(1);
		const h = hunks[0];
		expect(h?.ops.some((o) => o.type === "del" && o.line === "c")).toBe(true);
		expect(h?.ops.some((o) => o.type === "add" && o.line === "X")).toBe(true);
	});
});

describe("formatUnifiedDiff", () => {
	test("empty string when no difference", () => {
		expect(
			formatUnifiedDiff("a\nb", "a\nb", {
				fromLabel: "x",
				toLabel: "y",
				color: false,
			}),
		).toBe("");
	});

	test("plain output has ---/+++/@@ and -/+ markers, no ANSI", () => {
		const out = formatUnifiedDiff("a\nb\nc", "a\nB\nc", {
			fromLabel: "local",
			toLabel: "catalog",
			color: false,
		});
		expect(out).toContain("--- local");
		expect(out).toContain("+++ catalog");
		expect(out).toContain("@@");
		expect(out).toContain("-b");
		expect(out).toContain("+B");
		// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting no ANSI when color is off
		expect(out).not.toMatch(/\x1b\[/);
	});

	test("color output contains ANSI escapes", () => {
		const out = formatUnifiedDiff("a", "b", {
			fromLabel: "l",
			toLabel: "c",
			color: true,
		});
		// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting ANSI present when color is on
		expect(out).toMatch(/\x1b\[/);
	});
});
