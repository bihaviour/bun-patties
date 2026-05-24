import { describe, expect, test } from "bun:test";
import { generateAgentsMd } from "../../src/agents-md/generate.ts";

const FIXTURE = import.meta.dir + "/../fixtures/ai-app/app";

describe("generateAgentsMd", () => {
	test("emits expected sections for the fixture", async () => {
		const md = await generateAgentsMd(FIXTURE);
		expect(md).toContain("# AGENTS.md");
		expect(md).toContain("## Route map");
		expect(md).toContain("## Agents");
		expect(md).toContain("| booking |");
		expect(md).toContain("| concierge |");
		expect(md).toContain("### `search`");
		expect(md).toContain("| refresh-inventory |");
	}, 30_000);

	test("two consecutive runs are byte-identical", async () => {
		const a = await generateAgentsMd(FIXTURE);
		const b = await generateAgentsMd(FIXTURE);
		expect(a).toBe(b);
	}, 60_000);
});
