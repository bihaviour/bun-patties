import { defineMiddleware } from "../../../../src/middleware/index.ts";

export default defineMiddleware(async (req, ctx, next) => {
	if (new URL(req.url).pathname === "/old") {
		return ctx.redirect("/about", 302);
	}
	ctx.vars.mw = "ran";
	return next();
});
