// Standalone script run via Bun.spawn from subprocess-runner.ts.
// Protocol (line-delimited JSON over stdio):
//   stdin  → { id: string, file: string, kind: "agent" | "tool" | "job" }
//   stdout → { id: string, ok: true, data: ... } | { id: string, ok: false, error: string }
//
// `data` for tools includes a JSON-Schema rendering of the Zod input schema so
// the parent process doesn't need to import the user's Zod build.

import { zodToJsonSchema } from "./zod-to-json-schema.ts"

interface Request {
  id: string
  file: string
  kind: "agent" | "tool" | "job"
}

async function main(): Promise<void> {
  const decoder = new TextDecoder()
  let buf = ""
  for await (const chunk of Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const req = JSON.parse(trimmed) as Request
      const res = await handle(req)
      process.stdout.write(JSON.stringify(res) + "\n")
    }
  }
}

async function handle(req: Request): Promise<{ id: string; ok: boolean; data?: unknown; error?: string }> {
  try {
    const mod = (await import(req.file)) as { default?: unknown }
    const cfg = mod.default as Record<string, unknown> | undefined
    if (!cfg) return { id: req.id, ok: false, error: "module has no default export" }
    if (req.kind === "tool") {
      const inputSchema = cfg.input
      const inputJson = zodToJsonSchema(inputSchema)
      return {
        id: req.id,
        ok: true,
        data: {
          name: cfg.name,
          description: cfg.description,
          input: inputJson,
        },
      }
    }
    if (req.kind === "agent") {
      return {
        id: req.id,
        ok: true,
        data: {
          name: cfg.name,
          model: cfg.model,
          tools: cfg.tools ?? [],
          triggers: cfg.triggers ?? [],
          systemPrompt: cfg.systemPrompt,
        },
      }
    }
    // job
    return {
      id: req.id,
      ok: true,
      data: {
        name: cfg.name,
        schedule: cfg.schedule,
        tz: cfg.tz,
      },
    }
  } catch (err) {
    return { id: req.id, ok: false, error: (err as Error)?.message ?? String(err) }
  }
}

main().catch((err) => {
  process.stderr.write(`subprocess-entry fatal: ${(err as Error)?.message ?? String(err)}\n`)
  process.exit(1)
})
