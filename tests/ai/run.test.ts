import { afterEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { createAiContext } from "../../src/ai/context.ts";
import { ToolInputInvalid } from "../../src/ai/errors.ts";
import {
	__resetRegistry,
	getAgent,
	registerAgent,
	registerTool,
} from "../../src/ai/registry.ts";

afterEach(() => __resetRegistry());

// Build a fake Anthropic client that scripts the event sequence.
function fakeAnthropic(scripts: Array<AsyncIterable<unknown>>) {
	let i = 0;
	return {
		messages: {
			stream: () => scripts[i++]!,
			create: async () => null,
		},
	};
}

async function* events(items: unknown[]): AsyncIterable<unknown> {
	for (const e of items) yield e;
}

describe("agent run", () => {
	test("streams text deltas to the response stream", async () => {
		registerAgent({ name: "chat", model: "claude-x" });
		const ctx = createAiContext({
			anthropic: fakeAnthropic([
				events([
					{
						type: "content_block_start",
						content_block: { type: "text", text: "" },
					},
					{
						type: "content_block_delta",
						delta: { type: "text_delta", text: "hello " },
					},
					{
						type: "content_block_delta",
						delta: { type: "text_delta", text: "world" },
					},
					{ type: "content_block_stop" },
					{ type: "message_stop" },
				]),
			]),
		});
		const result = await getAgent("chat").run({ message: "hi" }, ctx);
		const text = await new Response(result.stream).text();
		expect(text).toBe("hello world");
	});

	test("tool with bad input throws ToolInputInvalid", async () => {
		registerTool({
			name: "search",
			description: "search",
			input: z.object({ city: z.string() }),
			handler: async (i) => i,
		});
		registerAgent({ name: "agent", model: "m", tools: ["search"] });
		const ctx = createAiContext({
			anthropic: fakeAnthropic([
				events([
					{
						type: "content_block_start",
						content_block: { type: "tool_use", id: "tu1", name: "search" },
					},
					{
						type: "content_block_delta",
						delta: { type: "input_json_delta", partial_json: '{"city":' },
					},
					{
						type: "content_block_delta",
						delta: { type: "input_json_delta", partial_json: "123}" },
					},
					{ type: "content_block_stop" },
					{ type: "message_stop" },
				]),
			]),
		});
		const result = await getAgent("agent").run({ message: "go" }, ctx);
		const reader = result.stream.getReader();
		let caught: unknown;
		try {
			// drain until error
			while (true) {
				const { done } = await reader.read();
				if (done) break;
			}
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(ToolInputInvalid);
	});

	test("tool happy path: handler runs and second round closes", async () => {
		let called = 0;
		registerTool({
			name: "echo",
			description: "echo",
			input: z.object({ s: z.string() }),
			handler: async (i: { s: string }) => {
				called++;
				return { got: i.s };
			},
		});
		registerAgent({ name: "agent2", model: "m", tools: ["echo"] });
		const ctx = createAiContext({
			anthropic: fakeAnthropic([
				events([
					{
						type: "content_block_start",
						content_block: { type: "tool_use", id: "tu1", name: "echo" },
					},
					{
						type: "content_block_delta",
						delta: { type: "input_json_delta", partial_json: '{"s":"hi"}' },
					},
					{ type: "content_block_stop" },
					{ type: "message_stop" },
				]),
				events([
					{
						type: "content_block_start",
						content_block: { type: "text", text: "" },
					},
					{
						type: "content_block_delta",
						delta: { type: "text_delta", text: "done" },
					},
					{ type: "content_block_stop" },
					{ type: "message_stop" },
				]),
			]),
		});
		const result = await getAgent("agent2").run({ message: "go" }, ctx);
		const text = await new Response(result.stream).text();
		expect(text).toBe("done");
		expect(called).toBe(1);
	});
});
