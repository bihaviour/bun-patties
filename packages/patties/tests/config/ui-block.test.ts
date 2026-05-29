import { describe, expect, test } from "bun:test";
import {
	PattiesConfigSchema,
	UiConfigSchema,
} from "../../src/config/schema.ts";

describe("config ui block", () => {
	test("absent ui leaves config.ui undefined", () => {
		const cfg = PattiesConfigSchema.parse({});
		expect(cfg.ui).toBeUndefined();
	});

	test("partial ui block fills convention defaults", () => {
		const ui = UiConfigSchema.parse({ componentsDir: "src/ui" });
		expect(ui.componentsDir).toBe("src/ui");
		expect(ui.tokensFile).toBe("app/styles/tokens.css");
		expect(ui.internalDir).toBeUndefined();
	});

	test("empty ui object yields all convention defaults", () => {
		const cfg = PattiesConfigSchema.parse({ ui: {} });
		expect(cfg.ui?.componentsDir).toBe("app/components/ui");
		expect(cfg.ui?.tokensFile).toBe("app/styles/tokens.css");
	});

	test("strict: an unknown key (aliases) is a config error", () => {
		expect(() => PattiesConfigSchema.parse({ ui: { aliases: {} } })).toThrow();
	});
});
