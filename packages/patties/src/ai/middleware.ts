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
				// Reuse the composer-generated correlation id so logs/agent traces
				// line up: ctx.aiContext.requestId === ctx.requestId.
				requestId: defaults.requestId ?? ctx.requestId,
				signal: req.signal,
			});
		}
		return next();
	};
}
