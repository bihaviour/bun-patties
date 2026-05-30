import { afterEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { AgentNotFound, ToolNotFound } from "../../src/ai/errors.ts";
import {
	__resetRegistry,
	getAgent,
	getTool,
	listAgents,
	registerAgent,
	registerTool,
} from "../../src/ai/registry.ts";

afterEach(() => __resetRegistry());

describe("registry", () => {
	test("get/register round-trip", () => {
		registerTool(
			{
				name: "echo",
				description: "echoes",
				input: z.object({ s: z.string() }),
				handler: (i: { s: string }) => i.s,
			},
			"/x/echo.ts",
		);
		registerAgent({ name: "a", model: "m", tools: ["echo"] }, "/x/a.ts");
		expect(getAgent("a").config.name).toBe("a");
		expect(getTool("echo").config.name).toBe("echo");
		expect(listAgents()).toHaveLength(1);
	});

	test("missing throws typed error with available list", () => {
		expect(() => getAgent("nope")).toThrow(AgentNotFound);
		expect(() => getTool("nope")).toThrow(ToolNotFound);
	});

	test("duplicate registration throws", () => {
		registerAgent({ name: "x", model: "m" }, "/a.ts");
		expect(() => registerAgent({ name: "x", model: "m" }, "/b.ts")).toThrow(
			/Duplicate agent name "x"/,
		);
	});
});
