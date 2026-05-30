import { describe, expect, test } from "bun:test";
import { rewriteRtl } from "../../src/cli/commands/ui/migrate/rtl.ts";

describe("rewriteRtl (tsx)", () => {
	test("rewrites physical margin/padding tokens in className", () => {
		const src = `<div className="ml-2 pr-4 mt-1" />`;
		const r = rewriteRtl(src, false);
		expect(r.output).toBe(`<div className="ms-2 pe-4 mt-1" />`);
		expect(r.changed).toBe(true);
	});

	test("rewrites text-left / text-right", () => {
		const r = rewriteRtl(`<p className="text-left" />`, false);
		expect(r.output).toContain('className="text-start"');
	});

	test("leaves unrelated tokens alone", () => {
		const src = `<div className="flex items-center gap-2 mt-4 mb-2" />`;
		expect(rewriteRtl(src, false).changed).toBe(false);
	});

	test("preserves variant prefixes and negatives", () => {
		const r = rewriteRtl(
			`<div className="md:ml-2 -mr-1 hover:left-0" />`,
			false,
		);
		expect(r.output).toContain("md:ms-2");
		expect(r.output).toContain("-me-1");
		expect(r.output).toContain("hover:start-0");
	});

	test("rewrites cn() string-literal arguments", () => {
		const r = rewriteRtl(`cn("ml-2", cond && "pr-3")`, false);
		expect(r.output).toBe(`cn("ms-2", cond && "pe-3")`);
	});

	test("rewrites style object margin/padding keys", () => {
		const r = rewriteRtl(
			`<div style={{ marginLeft: 4, color: "red" }} />`,
			false,
		);
		expect(r.output).toContain("marginInlineStart");
		expect(r.output).toContain('color: "red"');
	});

	test("reports dynamic className templates instead of guessing", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: literal source-under-test — the ${x} is the dynamic interpolation we expect the codemod to refuse
		const src = "<div className={`ml-2 ${x}`} />";
		const r = rewriteRtl(src, false);
		expect(r.output).toBe(src);
		expect(r.reports.length).toBeGreaterThan(0);
	});

	test("is idempotent on already-logical classes", () => {
		const src = `<div className="ms-2 pe-4" />`;
		expect(rewriteRtl(src, false).changed).toBe(false);
	});
});

describe("rewriteRtl (css)", () => {
	test("rewrites CSS physical properties to logical", () => {
		const src = `.x { margin-left: 4px; padding-right: 2px; }`;
		const r = rewriteRtl(src, true);
		expect(r.output).toContain("margin-inline-start");
		expect(r.output).toContain("padding-inline-end");
	});
});
