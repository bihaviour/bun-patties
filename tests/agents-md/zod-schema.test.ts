import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { zodToJsonSchema } from "../../src/agents-md/zod-to-json-schema.ts"

describe("zodToJsonSchema", () => {
  test("object with required props", () => {
    const out = zodToJsonSchema(z.object({ a: z.string(), b: z.number().optional() })) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(out.type).toBe("object")
    expect(out.properties.a).toEqual({ type: "string" })
    expect(out.properties.b).toEqual({ type: "number" })
    expect(out.required).toEqual(["a"])
  })

  test("array + enum", () => {
    const out = zodToJsonSchema(z.array(z.enum(["x", "y"]))) as {
      type: string
      items: { type: string; enum: string[] }
    }
    expect(out.type).toBe("array")
    expect(out.items.enum).toEqual(["x", "y"])
  })

  test("non-schema falls back with warning", () => {
    const warns: string[] = []
    const out = zodToJsonSchema({ not: "a schema" } as unknown, warns)
    expect((out as { type: string }).type).toBe("unknown")
    expect(warns.length).toBeGreaterThan(0)
  })
})
