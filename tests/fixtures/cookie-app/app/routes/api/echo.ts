import type { PattiesContext } from "../../../../../../src/middleware/index.ts";

export function GET(req: Request, ctx: PattiesContext): Response {
	const name = new URL(req.url).searchParams.get("name") ?? "sid";
	const cookies = ctx.cookies as {
		get?: (name: string) => string | null | undefined;
	} | null;
	return ctx.json({ name, value: cookies?.get?.(name) ?? null });
}
