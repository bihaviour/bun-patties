import type { AiContext } from "./types.ts"

export interface StreamTextOptions {
  ctx: AiContext
  model: string
  system?: string
  messages: Array<{ role: "user" | "assistant"; content: unknown }>
  tools?: Array<{ name: string; description: string; input_schema: unknown }>
  maxTokens?: number
}

// Thin wrapper that defaults prompt caching on for system + tool definitions.
// Returns the underlying stream object (an AsyncIterable of events). Callers
// pipe it to a Response or iterate manually.
export function streamText(opts: StreamTextOptions): AsyncIterable<unknown> {
  const params = buildParams(opts)
  const result = opts.ctx.anthropic.messages.stream(params) as AsyncIterable<unknown>
  return result
}

export interface StreamObjectOptions extends StreamTextOptions {
  // Structured-output schema name; the model is asked to emit a single
  // tool_use matching this name.
  schemaName: string
  schema: unknown
}

export function streamObject(opts: StreamObjectOptions): AsyncIterable<unknown> {
  const tools = [
    {
      name: opts.schemaName,
      description: "Structured output schema.",
      input_schema: opts.schema,
    },
  ]
  return streamText({ ...opts, tools, system: opts.system })
}

function buildParams(opts: StreamTextOptions): Record<string, unknown> {
  const cachedSystem = opts.system
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : undefined
  const cachedTools = opts.tools && opts.tools.length > 0
    ? opts.tools.map((t, i) => {
        // Cache only the last tool to anchor the cache breakpoint at the end
        // of the tools block (Anthropic caches prefix up to the breakpoint).
        if (i === opts.tools!.length - 1) return { ...t, cache_control: { type: "ephemeral" } }
        return t
      })
    : undefined

  return {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system: cachedSystem,
    tools: cachedTools,
    messages: opts.messages,
  }
}
