import type { Middleware } from "../middleware/index.ts";
import { type CreateAiContextOptions, createAiContext } from "./context.ts";

// Populates ctx.aiContext on every request. Registered automatically by the
// router when the agent/tool registry is non-empty.
export function createAiContextMiddleware(
	defaults: CreateAiContextOptions = {},
): Middleware {
	return async (req, ctx, next) => {
		if (!ctx.aiContext) {
			ctx.aiContext = createAiContext({
				...defaults,
				requestId: defaults.requestId ?? cryptoRandomId(),
				signal: req.signal,
			});
		}
		return next();
	};
}

function cryptoRandomId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto)
		return crypto.randomUUID();
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
