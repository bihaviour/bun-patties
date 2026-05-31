import type { PattiesContext } from "patties/middleware";

// API routes live under app/routes/api/ and export named HTTP methods
// (GET/POST/…) that return a standard Response. `ctx.json()` is the thin
// PattiesContext helper for JSON replies.
export function GET(_req: Request, ctx: PattiesContext): Response {
	return ctx.json({ ok: true });
}
