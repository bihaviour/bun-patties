import type { PattiesContext } from "../../../../../../src/middleware/index.ts"

export function GET(_req: Request, ctx: PattiesContext): Response {
  return ctx.json({ ok: true, mw: ctx.vars.mw ?? null })
}
