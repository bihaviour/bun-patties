import { describe, expect, test } from "bun:test"
import { createAiContextMiddleware } from "../../src/ai/middleware.ts"
import { makeContext } from "../../src/middleware/index.ts"

describe("createAiContextMiddleware", () => {
  test("populates ctx.aiContext exactly once per request", async () => {
    const mw = createAiContextMiddleware()
    const req = new Request("http://x/test")
    const ctx = makeContext(req)
    let seen: unknown
    await mw(req, ctx, async () => {
      seen = ctx.aiContext
      return new Response("ok")
    })
    expect(seen).toBeDefined()
    expect((seen as { requestId: string }).requestId).toBeTruthy()
  })

  test("preserves existing aiContext if already set", async () => {
    const mw = createAiContextMiddleware()
    const req = new Request("http://x/test")
    const ctx = makeContext(req)
    const preset = { requestId: "pre", vars: {} } as unknown as NonNullable<typeof ctx.aiContext>
    ctx.aiContext = preset
    await mw(req, ctx, async () => new Response("ok"))
    expect(ctx.aiContext).toBe(preset)
  })
})
