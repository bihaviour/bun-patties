import { generateRequestId } from "../middleware/request-id.ts";
import { AnthropicSdkNotInstalled, MissingAnthropicKey } from "./errors.ts";
import type { AiContext, AnthropicLike } from "./types.ts";

export interface CreateAiContextOptions {
	requestId?: string;
	user?: unknown;
	signal?: AbortSignal;
	vars?: Record<string, unknown>;
	// Inject a client (for tests or programmatic callers wanting per-context isolation).
	anthropic?: AnthropicLike;
	// Inject a constructor (for tests). Defaults to the real `@anthropic-ai/sdk`.
	anthropicCtor?: new (opts: {
		apiKey: string;
	}) => AnthropicLike;
	apiKey?: string;
}

export function createAiContext(opts: CreateAiContextOptions = {}): AiContext {
	const requestId = opts.requestId ?? generateRequestId();
	let cached: AnthropicLike | null = opts.anthropic ?? null;

	const ctx: AiContext = {
		requestId,
		user: opts.user,
		signal: opts.signal,
		vars: opts.vars ?? {},
		get anthropic() {
			if (cached) return cached;
			cached = buildAnthropic(opts);
			return cached;
		},
	} as AiContext & { anthropic: AnthropicLike };

	return ctx;
}

function buildAnthropic(opts: CreateAiContextOptions): AnthropicLike {
	const apiKey = opts.apiKey ?? readApiKey();
	if (!apiKey) throw new MissingAnthropicKey();

	if (opts.anthropicCtor) {
		return new opts.anthropicCtor({ apiKey });
	}

	let SdkCtor: new (opts: { apiKey: string }) => AnthropicLike;
	try {
		// Dynamic require so the dep stays optional. `Bun.resolveSync` throws if absent.
		const mod = (
			globalThis as unknown as { require?: (id: string) => unknown }
		).require?.("@anthropic-ai/sdk") as
			| { default?: unknown; Anthropic?: unknown }
			| undefined;
		const Ctor = (mod?.default ?? mod?.Anthropic) as
			| (new (opts: {
					apiKey: string;
			  }) => AnthropicLike)
			| undefined;
		if (!Ctor) throw new AnthropicSdkNotInstalled();
		SdkCtor = Ctor;
	} catch (err) {
		if (err instanceof AnthropicSdkNotInstalled) throw err;
		throw new AnthropicSdkNotInstalled(err);
	}

	return new SdkCtor({ apiKey });
}

function readApiKey(): string | undefined {
	const env = (typeof Bun !== "undefined" ? Bun.env : process.env) as Record<
		string,
		string | undefined
	>;
	return env.ANTHROPIC_API_KEY;
}
