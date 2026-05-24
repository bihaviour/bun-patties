import { z } from "zod"
import type { AgentConfig, AgentRunResult, AiContext } from "./types.ts"
import { getTool } from "./registry.ts"
import { streamText } from "./stream.ts"
import { ToolInputInvalid } from "./errors.ts"

const MAX_TOOL_ROUNDS = 8

export async function runAgent(
  config: AgentConfig,
  input: { message: string } & Record<string, unknown>,
  ctx: AiContext,
): Promise<AgentRunResult> {
  // Resolve tool defs eagerly so missing tools throw before we open a stream.
  const toolDefs = (config.tools ?? []).map((name) => {
    const t = getTool(name)
    return {
      name: t.config.name,
      description: t.config.description,
      input_schema: zodToJsonSchemaLite(t.config.input),
    }
  })

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: input.message },
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const events = streamText({
            ctx,
            model: config.model,
            system: config.systemPrompt,
            tools: toolDefs.length > 0 ? toolDefs : undefined,
            messages,
            maxTokens: config.maxTokens ?? 1024,
          })

          const accumulated = await consumeStream(events, controller, encoder)

          if (accumulated.toolUses.length === 0) break

          messages.push({ role: "assistant", content: accumulated.assistantContent })

          const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }> = []
          for (const use of accumulated.toolUses) {
            const tool = getTool(use.name)
            const parsed = tool.config.input.safeParse(use.input)
            if (!parsed.success) {
              throw new ToolInputInvalid(use.name, parsed.error.issues)
            }
            const out = await tool.config.handler(parsed.data, ctx)
            toolResults.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: typeof out === "string" ? out : JSON.stringify(out),
            })
          }
          messages.push({ role: "user", content: toolResults })
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return { stream }
}

interface Accumulated {
  toolUses: Array<{ id: string; name: string; input: unknown }>
  assistantContent: unknown[]
}

async function consumeStream(
  events: AsyncIterable<unknown>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<Accumulated> {
  const toolUses: Array<{ id: string; name: string; input: unknown }> = []
  const assistantContent: unknown[] = []
  let currentToolJson = ""
  let currentToolIndex = -1

  for await (const ev of events as AsyncIterable<Record<string, unknown>>) {
    const type = ev.type as string | undefined

    if (type === "content_block_start") {
      const block = ev.content_block as { type: string; id?: string; name?: string; text?: string }
      if (block.type === "tool_use") {
        currentToolIndex = toolUses.length
        toolUses.push({ id: block.id ?? "", name: block.name ?? "", input: {} })
        currentToolJson = ""
        assistantContent.push({ type: "tool_use", id: block.id, name: block.name, input: {} })
      } else if (block.type === "text") {
        assistantContent.push({ type: "text", text: block.text ?? "" })
      }
      continue
    }

    if (type === "content_block_delta") {
      const delta = ev.delta as { type: string; text?: string; partial_json?: string }
      if (delta.type === "text_delta" && delta.text) {
        controller.enqueue(encoder.encode(delta.text))
        const last = assistantContent[assistantContent.length - 1] as { type: string; text?: string }
        if (last && last.type === "text") last.text = (last.text ?? "") + delta.text
      } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
        currentToolJson += delta.partial_json
      }
      continue
    }

    if (type === "content_block_stop") {
      if (currentToolIndex >= 0 && currentToolJson) {
        try {
          const parsed = JSON.parse(currentToolJson) as unknown
          toolUses[currentToolIndex]!.input = parsed
          const ac = assistantContent.find(
            (c) => (c as { id?: string }).id === toolUses[currentToolIndex]!.id,
          ) as { input?: unknown } | undefined
          if (ac) ac.input = parsed
        } catch {
          // leave as raw string — model bug, surfaced when Zod parses below
          toolUses[currentToolIndex]!.input = currentToolJson
        }
        currentToolIndex = -1
        currentToolJson = ""
      }
      continue
    }

    // message_delta / message_stop / message_start: nothing to emit
  }

  return { toolUses, assistantContent }
}

function zodToJsonSchemaLite(schema: unknown): unknown {
  try {
    const out = z.toJSONSchema(schema as z.ZodType) as Record<string, unknown>
    delete out.$schema
    return out
  } catch {
    return { type: "object" }
  }
}
