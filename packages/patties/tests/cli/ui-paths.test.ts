import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	assertInsideProject,
	resolveUiPaths,
	UiPathError,
} from "../../src/cli/commands/add/ui-paths.ts";

const CWD = "/tmp/project";

describe("assertInsideProject", () => {
	test("resolves a relative path under the project root", () => {
		expect(assertInsideProject(CWD, "src/ui")).toBe(join(CWD, "src/ui"));
	});

	test("allows the project root itself", () => {
		expect(assertInsideProject(CWD, ".")).toBe(CWD);
	});

	test("rejects an absolute path", () => {
		expect(() => assertInsideProject(CWD, "/etc")).toThrow(UiPathError);
	});

	test("rejects a path escaping the project root", () => {
		expect(() => assertInsideProject(CWD, "../../outside")).toThrow(
			UiPathError,
		);
	});

	test("rejects a sibling prefix that is not actually inside", () => {
		expect(() => assertInsideProject("/tmp/proj", "../proj-evil")).toThrow(
			UiPathError,
		);
	});
});

describe("resolveUiPaths", () => {
	test("convention defaults when nothing is configured", () => {
		const p = resolveUiPaths({ cwd: CWD });
		expect(p.componentsDir).toBe(join(CWD, "app/components/ui"));
		expect(p.internalDir).toBe(join(CWD, "app/components/ui/_internal"));
		expect(p.tokensFile).toBe(join(CWD, "app/styles/tokens.css"));
	});

	test("config.ui.componentsDir moves components + co-located helpers", () => {
		const p = resolveUiPaths({ cwd: CWD, ui: { componentsDir: "src/ui" } });
		expect(p.componentsDir).toBe(join(CWD, "src/ui"));
		expect(p.internalDir).toBe(join(CWD, "src/ui/_internal"));
		expect(p.tokensFile).toBe(join(CWD, "app/styles/tokens.css"));
	});

	test("config.ui.internalDir is honored independently", () => {
		const p = resolveUiPaths({
			cwd: CWD,
			ui: { componentsDir: "src/ui", internalDir: "src/lib/helpers" },
		});
		expect(p.internalDir).toBe(join(CWD, "src/lib/helpers"));
	});

	test("config.ui.tokensFile redirects tokens", () => {
		const p = resolveUiPaths({
			cwd: CWD,
			ui: { tokensFile: "styles/theme.css" },
		});
		expect(p.tokensFile).toBe(join(CWD, "styles/theme.css"));
	});

	test("--path overrides config and retargets helpers, never tokens", () => {
		const p = resolveUiPaths({
			cwd: CWD,
			ui: {
				componentsDir: "src/ui",
				internalDir: "src/lib",
				tokensFile: "x.css",
			},
			pathOverride: "packages/web/ui",
		});
		expect(p.componentsDir).toBe(join(CWD, "packages/web/ui"));
		expect(p.internalDir).toBe(join(CWD, "packages/web/ui/_internal"));
		expect(p.tokensFile).toBe(join(CWD, "x.css"));
	});

	test("--path escaping the root throws", () => {
		expect(() =>
			resolveUiPaths({ cwd: CWD, pathOverride: "../../etc" }),
		).toThrow(UiPathError);
	});
});
