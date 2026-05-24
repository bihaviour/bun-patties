import { defineMiddleware } from "../../../../src/middleware/index.ts";

export default defineMiddleware(async (_req, ctx, next) => {
	const cookies = ctx.cookies as {
		set?: (name: string, value: string) => void;
	} | null;
	cookies?.set?.("sid", "abc");
	return next();
});
