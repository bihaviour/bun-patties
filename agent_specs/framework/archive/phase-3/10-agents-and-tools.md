---
spec: framework/10-agents-and-tools
title: Agents & Tools (AI-Native Layer)
status: draft
phase: 3
file: app/agents/*.ts, app/tools/*.ts
last_reviewed: 2026-05-23
---

# Spec 10 — Agents & Tools (AI-Native Layer)

## Purpose

This is the layer that separates Patties from HonoX. Agents and tools are first-class filesystem entries — not configuration, not plugins. The framework wires the Anthropic SDK, exposes `streamText` and `streamObject`, and propagates request context to every agent call.

## User contracts

### Agent

```ts
// app/agents/booking.ts
import { defineAgent } from "patties/ai"

export default defineAgent({
  name: "booking",
  model: "claude-sonnet-4-6",
  tools: ["search", "availability"],     // tool names from app/tools/
  systemPrompt: "...",
  triggers: ["POST /api/booking/chat"]   // optional auto-wiring
})
```

### Tool

```ts
// app/tools/search.ts
import { defineTool } from "patties/ai"
import { z } from "zod"

export default defineTool({
  name: "search",
  description: "Search hotel inventory by city and dates.",
  input: z.object({ city: z.string(), from: z.string(), to: z.string() }),
  async handler(input, ctx) {
    return { results: [] }
  }
})
```

## Framework exports

- `streamText(opts)` — wraps Anthropic Messages streaming with sensible Patties defaults (prompt caching enabled, retry policy).
- `streamObject(opts)` — structured output streaming with a Zod schema.
- `getAgent(name)` — programmatic invocation in any route handler or background script.
- `getTool(name)` — same, for tools.
- `createAiContext(opts)` — build an `AiContext` for callers outside a request (CLI scripts, cron jobs, queue handlers, scheduled tasks, tests).

## AI context

Every agent and tool execution receives an `AiContext`:

```ts
interface AiContext {
  requestId: string
  user?: unknown               // populated by an auth plugin if present
  anthropic: Anthropic         // per-context client, prompt-caching keys scoped here
  signal?: AbortSignal
  // free-form bag plugins may attach to:
  vars: Record<string, unknown>
}
```

### Inside a request

A framework middleware (registered by `createRouter` when any agent or tool exists) populates `ctx.aiContext` once per request. Route handlers do not need to pass it explicitly:

```ts
// app/routes/api/booking/chat.ts
export async function POST(req: Request, ctx: PattiesContext) {
  const result = await getAgent("booking").run({ message: "..." }, ctx.aiContext!)
  return new Response(result.stream, { headers: { "Content-Type": "text/event-stream" } })
}
```

### Outside a request (programmatic)

`getAgent(name).run(input, ctx)` requires an explicit `AiContext`. Construct one with `createAiContext`:

```ts
import { createAiContext, getAgent } from "patties/ai"

const ctx = createAiContext({ requestId: crypto.randomUUID() })
await getAgent("booking").run({ message: "from a cron" }, ctx)
```

This keeps context flow visible and testable — no module-level globals, no `AsyncLocalStorage` traps. Tool handlers always receive the same `ctx` as their second argument.

## Scheduled jobs (`app/jobs/`)

Recurring work has a first-class home parallel to `app/agents/` and `app/tools/`:

```ts
// app/jobs/refresh-inventory.ts
import { defineJob } from "patties/ai"

export default defineJob({
  name: "refresh-inventory",
  schedule: "*/15 * * * *",        // standard cron expression
  tz: "Asia/Makassar",             // explicit TZ required — no implicit process TZ
  async handler(ctx) {
    // ctx is AiContext, built per fire via createAiContext()
  },
})
```

Behavior:
- On boot, the framework scans `app/jobs/**/*.ts` via `Bun.Glob` and registers each handler with `Bun.cron(schedule, handler)` on the `bun` target.
- Each fire constructs a fresh `AiContext` via `createAiContext()` — no request to thread through, no `c.var`.
- On the `edge` target, the framework does not register cron handlers itself. The job inventory is exposed to deploy plugins via the `onJobsCollect` hook ([09-plugins](../phase-4/09-plugins.md)); each deploy plugin emits vendor-native cron triggers (`wrangler.toml [triggers]`, `vercel.json crons`, etc.).
- **Multi-instance fires**: Phase 2 ships without a singleton mechanism — multi-replica deploys fire each job N times. The `singleton: true + Redis` mechanism is a follow-up RFC once `@patties/cache` lands. Document this in dev logs at boot if `server.reusePort` is true.

See [[rfc-bun-cron]].

## Triggers and route conflicts

`triggers: ["POST /api/booking/chat"]` is **opt-in auto-wiring**. When present, the framework registers a default handler at that method/path that streams the agent's response.

If a filesystem route file (e.g. `app/routes/api/booking/chat.ts` exporting `POST`) claims the same method+path:

- The filesystem route **always wins**. The framework does not register the trigger handler.
- A warning is logged at boot naming both the agent and the conflicting route file. The warning lists the path once per conflicting method.
- This is intentional: hand-written code is the source of truth; declarative triggers are convenience scaffolding the user can override at any time.

## Name enforcement

Agent and tool `name` fields must match their filename basename (kebab-case, see [13-conventions](../13-conventions.md)):

- `app/agents/booking.ts` must export `defineAgent({ name: "booking", ... })`.
- A mismatch (`name: "bookings"` in `booking.ts`) throws at boot with both names cited.
- Boot collects all mismatches before throwing, so the developer sees every problem in one error.
- Two agents (or two tools) declaring the same `name` is also a boot error — both file paths are named in the message.

## Anthropic SDK wiring

- The framework ships `@anthropic-ai/sdk` as a peer dependency.
- API key is read from `ANTHROPIC_API_KEY` env; failure to find one when an agent runs throws a typed error.
- Prompt caching is on by default for system prompts and tool definitions.

## Non-goals

- Multi-provider abstractions (Anthropic only — by design).
- A queue/worker layer. If you need queues, use whatever your host provides (Cloudflare Queues, AWS SQS, Upstash QStash, etc.) via a capability plugin — the framework stays neutral.

## Acceptance criteria

- An agent with one tool can be invoked from an API route and streams a response.
- Tool input validation failures return a `400` with the Zod issue list.
- Removing `ANTHROPIC_API_KEY` and invoking an agent throws `MissingAnthropicKey` with remediation text.
