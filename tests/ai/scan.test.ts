import { describe, expect, test } from "bun:test";
import { scanAgents, scanJobs, scanTools } from "../../src/ai/scan.ts";

const FIXTURE = import.meta.dir + "/../fixtures/ai-app/app";

describe("scan", () => {
	test("scanAgents finds both agents", async () => {
		const agents = await scanAgents(FIXTURE);
		const names = agents.map((a) => a.name).sort();
		expect(names).toEqual(["booking", "concierge"]);
	});

	test("scanTools finds search", async () => {
		const tools = await scanTools(FIXTURE);
		expect(tools.map((t) => t.name)).toEqual(["search"]);
	});

	test("scanJobs finds refresh-inventory", async () => {
		const jobs = await scanJobs(FIXTURE);
		expect(jobs.map((j) => j.name)).toEqual(["refresh-inventory"]);
	});

	test("returns [] for missing dir", async () => {
		const out = await scanAgents("/tmp/__nonexistent__/__patties__");
		expect(out).toEqual([]);
	});
});
