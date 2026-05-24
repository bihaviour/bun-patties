import type { PattiesContext } from "../../../../../../src/middleware/index.ts";

export function GET(_req: Request, ctx: PattiesContext): Response {
	return ctx.json({ ok: true, mw: ctx.vars.mw ?? null });
}

export async function POST(
	req: Request,
	ctx: PattiesContext,
): Promise<Response> {
	const body = (await req.json().catch(() => ({}))) as { value?: unknown };
	return ctx.json({ ok: true, echo: body.value ?? null });
}
