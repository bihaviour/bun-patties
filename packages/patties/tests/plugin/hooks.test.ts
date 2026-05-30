import { afterAll, describe, expect, test } from "bun:test";
import { generateAgentsMd } from "../../src/agents-md/generate.ts";
import { build } from "../../src/build/index.ts";
import { definePlugin } from "../../src/plugin/index.ts";

const FIXTURES = `${import.meta.dir}/../fixtures`;

afterAll(async () => {
	await Bun.$`rm -rf ${FIXTURES}/no-middleware-app/app/patties-gen`.quiet();
});

describe("plugin hooks", () => {
	test("onBuildStart, onJobsCollect, onBuildEnd fire in order", async () => {
		const order: string[] = [];
		let jobsSeen: unknown = null;
		const plugin = definePlugin({
			name: "tracer",
			hooks: {
				onBuildStart(opts) {
					order.push("start");
					expect(opts.appDir).toContain("no-middleware-app");
				},
				onJobsCollect(jobs) {
					order.push("jobs");
					jobsSeen = jobs;
				},
				onBuildEnd(result) {
					order.push("end");
					expect(typeof result.serverEntry).toBe("string");
				},
			},
		});
		const out = `/tmp/patties-test-build-${Date.now()}`;
		await build({
			appDir: `${FIXTURES}/no-middleware-app/app`,
			outDir: out,
			target: "bun",
			mode: "production",
			plugins: [plugin],
		});
		expect(order).toEqual(["start", "jobs", "end"]);
		expect(Array.isArray(jobsSeen)).toBe(true);
	});

	test("onAgentsMdGenerate can transform document", async () => {
		const plugin = definePlugin({
			name: "appender",
			hooks: {
				onAgentsMdGenerate(doc) {
					return { markdown: `${doc.markdown}\n<!-- from plugin -->` };
				},
			},
		});
		const md = await generateAgentsMd(`${FIXTURES}/basic-app/app`, {
			appDir: `${FIXTURES}/basic-app/app`,
			plugins: [plugin],
		});
		expect(md.endsWith("<!-- from plugin -->")).toBe(true);
	});

	test("hook error names the plugin", async () => {
		const plugin = definePlugin({
			name: "boomer",
			hooks: {
				onAgentsMdGenerate() {
					throw new Error("nope");
				},
			},
		});
		await expect(
			generateAgentsMd(`${FIXTURES}/basic-app/app`, {
				appDir: `${FIXTURES}/basic-app/app`,
				plugins: [plugin],
			}),
		).rejects.toThrow(/\[plugin boomer\] onAgentsMdGenerate: nope/);
	});
});
