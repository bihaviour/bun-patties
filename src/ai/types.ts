import type { z } from "zod"

export interface AiContext {
  requestId: string
  user?: unknown
  anthropic: AnthropicLike
  signal?: AbortSignal
  vars: Record<string, unknown>
}

// Minimal structural type — avoids hard-importing @anthropic-ai/sdk at module
// load time. The real SDK is a peer dep populated by users that need agents.
export interface AnthropicLike {
  messages: {
    stream: (opts: unknown) => unknown
    create: (opts: unknown) => Promise<unknown>
  }
}

export type AgentTrigger = `${"GET" | "POST" | "PUT" | "DELETE" | "PATCH"} /${string}`

export interface AgentConfig {
  name: string
  model: string
  tools?: string[]
  systemPrompt?: string
  triggers?: AgentTrigger[]
  maxTokens?: number
}

export interface ToolConfig<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  input: z.ZodType<TInput>
  handler: (input: TInput, ctx: AiContext) => Promise<TOutput> | TOutput
}

export interface JobConfig {
  name: string
  schedule: string
  tz: string
  handler: (ctx: AiContext) => Promise<void> | void
}

export interface AgentRunResult {
  stream: ReadableStream<Uint8Array>
}

export interface RegisteredAgent {
  config: AgentConfig
  filePath?: string
  run: (input: { message: string } & Record<string, unknown>, ctx: AiContext) => Promise<AgentRunResult>
}

export interface RegisteredTool {
  config: ToolConfig
  filePath?: string
}

export interface RegisteredJob {
  config: JobConfig
  filePath?: string
}
