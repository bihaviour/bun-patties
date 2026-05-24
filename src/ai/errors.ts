import type { z } from "zod"

export class MissingAnthropicKey extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Patties agents require an Anthropic API key. " +
        "Set ANTHROPIC_API_KEY in your environment (or .env.local) before invoking an agent.",
    )
    this.name = "MissingAnthropicKey"
  }
}

export class AgentNotFound extends Error {
  constructor(name: string, available: string[]) {
    super(
      `Agent "${name}" is not registered. Available agents: ${available.length ? available.join(", ") : "(none)"}.`,
    )
    this.name = "AgentNotFound"
  }
}

export class ToolNotFound extends Error {
  constructor(name: string, available: string[]) {
    super(
      `Tool "${name}" is not registered. Available tools: ${available.length ? available.join(", ") : "(none)"}.`,
    )
    this.name = "ToolNotFound"
  }
}

export class ToolInputInvalid extends Error {
  readonly issues: z.ZodIssue[]
  readonly tool: string
  constructor(tool: string, issues: z.ZodIssue[]) {
    super(`Tool "${tool}" received invalid input: ${issues.length} issue(s).`)
    this.name = "ToolInputInvalid"
    this.tool = tool
    this.issues = issues
  }
}

export class AnthropicSdkNotInstalled extends Error {
  constructor(cause?: unknown) {
    super(
      '"@anthropic-ai/sdk" is required to run agents but is not installed. ' +
        'Install it with `bun add @anthropic-ai/sdk`.',
    )
    this.name = "AnthropicSdkNotInstalled"
    if (cause) (this as { cause?: unknown }).cause = cause
  }
}
