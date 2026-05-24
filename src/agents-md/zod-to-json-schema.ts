import { z } from "zod"

// Wrap zod v4's built-in toJSONSchema with a never-throw guard so a single bad
// schema can't fail AGENTS.md generation. Falls back to { type: "unknown" }.
export function zodToJsonSchema(schema: unknown, warnings?: string[]): unknown {
  if (!schema || typeof schema !== "object") return { type: "unknown" }
  try {
    const out = z.toJSONSchema(schema as z.ZodType) as Record<string, unknown>
    // Drop the $schema marker so we don't bloat the AGENTS.md JSON blocks.
    delete out.$schema
    return out
  } catch (err) {
    warnings?.push(`zod->json-schema failed: ${(err as Error).message ?? String(err)}`)
    return { type: "unknown" }
  }
}
