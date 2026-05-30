/**
 * Tracks request counts and attaches a marker for downstream handlers.
 */
import { defineMiddleware } from "../../../../src/middleware/index.ts";

export default defineMiddleware(async (_req, ctx, next) => {
	ctx.vars.mw = "ran";
	return next();
});
