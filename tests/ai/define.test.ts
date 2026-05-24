import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { defineAgent, defineTool, defineJob } from "../../src/ai/define.ts"

describe("define helpers", () => {
  test("defineAgent passes config through", () => {
    const a = defineAgent({ name: "x", model: "claude-sonnet-4-6", tools: ["t"] })
    expect(a.name).toBe("x")
    expect(a.tools).toEqual(["t"])
  })

  test("defineTool retains schema", () => {
    const t = defineTool({
      name: "t",
      description: "d",
      input: z.object({ q: z.string() }),
      handler: async (input) => input.q,
    })
    expect(t.name).toBe("t")
    const ok = t.input.safeParse({ q: "hi" })
    expect(ok.success).toBe(true)
  })

  test("defineJob requires tz", () => {
    const j = defineJob({ name: "j", schedule: "* * * * *", tz: "UTC", handler: () => {} })
    expect(j.tz).toBe("UTC")
  })
})
