import { defineMiddleware } from "../../../../src/middleware/index.ts";

let count = 0;
export const __getCount = () => count;
export const __resetCount = () => {
	count = 0;
};

export default defineMiddleware(async (_req, ctx, next) => {
	count += 1;
	ctx.vars.mw = "ran";
	return next();
});
