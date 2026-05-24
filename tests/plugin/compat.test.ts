import { describe, expect, test } from "bun:test";
import {
	assertPluginCompat,
	definePlugin,
	type PluginLogger,
} from "../../src/plugin/index.ts";

describe("assertPluginCompat", () => {
	test("passes when range satisfies framework version", () => {
		const p = definePlugin({ name: "a", compat: "^1.0.0" });
		expect(() => assertPluginCompat("1.2.3", p)).not.toThrow();
	});

	test("throws when range does not satisfy", () => {
		const p = definePlugin({ name: "a", compat: "^99.0.0" });
		expect(() => assertPluginCompat("1.2.3", p)).toThrow(
			/\[plugin a\].*1\.2\.3.*\^99\.0\.0/,
		);
	});

	test("warns when compat is absent", () => {
		const warnings: string[] = [];
		const logger: PluginLogger = {
			info: () => {},
			warn: (m) => warnings.push(m),
			error: () => {},
		};
		const p = definePlugin({ name: "loose" });
		assertPluginCompat("1.0.0", p, logger);
		expect(warnings.length).toBe(1);
		expect(warnings[0]).toContain("loose");
	});
});
