import { expect, test } from "bun:test";
import {
	generateServerEntry,
	type ServerEntryInput,
} from "../../src/build/server-entry.ts";

const base: Omit<ServerEntryInput, "target" | "compile"> = {
	appDir: "/abs/app",
	entries: [],
	hasUserMiddleware: false,
	frameworkRoot: "/abs/fw/src",
	routesMacroPath: "/abs/fw/src/build/macros/routes.macro.ts",
	envMacroPath: "/abs/fw/src/build/macros/env.macro.ts",
	manifestMacroPath: "/abs/fw/src/build/macros/manifest.macro.ts",
	agentsHashMacroPath: "/abs/fw/src/build/macros/agents-hash.macro.ts",
	manifestPath: "/abs/out/manifest.json",
	port: 3000,
};

test("bun + compile emits embedded-manifest import and staticRoutes", () => {
	const src = generateServerEntry({ ...base, target: "bun", compile: true });
	expect(src).toContain(
		'import { EMBEDDED_ASSET_PATHS } from "./embedded-manifest.ts"',
	);
	expect(src).toContain("Bun.embeddedFiles");
	expect(src).toContain("staticRoutes: __staticMap,");
});

test("bun without compile leaves the entry unchanged", () => {
	const src = generateServerEntry({ ...base, target: "bun", compile: false });
	expect(src).not.toContain("embedded-manifest");
	expect(src).not.toContain("Bun.embeddedFiles");
	expect(src).not.toContain("staticRoutes");
});

test("edge ignores the compile flag", () => {
	const src = generateServerEntry({ ...base, target: "edge", compile: true });
	expect(src).not.toContain("embedded-manifest");
	expect(src).not.toContain("Bun.embeddedFiles");
});
