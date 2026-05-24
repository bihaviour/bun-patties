import { describe, expect, test } from "bun:test";
import { createAiContext } from "../../src/ai/context.ts";
import { MissingAnthropicKey } from "../../src/ai/errors.ts";

describe("createAiContext", () => {
	test("returns a context with requestId + vars", () => {
		const ctx = createAiContext({ requestId: "req-1" });
		expect(ctx.requestId).toBe("req-1");
		expect(ctx.vars).toEqual({});
	});

	test("does not touch anthropic key until anthropic is read", () => {
		const prev = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		try {
			const ctx = createAiContext();
			expect(ctx.requestId).toBeTruthy();
			expect(() => ctx.anthropic).toThrow(MissingAnthropicKey);
		} finally {
			if (prev) process.env.ANTHROPIC_API_KEY = prev;
		}
	});

	test("uses injected client when provided", () => {
		const fake = { messages: { stream: () => null, create: async () => null } };
		const ctx = createAiContext({ anthropic: fake });
		expect(ctx.anthropic).toBe(fake);
	});
});
