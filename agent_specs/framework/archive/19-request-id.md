---
spec: framework/19-request-id
title: Request IDs — ctx.requestId + X-Request-Id echo
status: completed
phase: dev-dx
file: src/middleware/{request-id,cookies,index}.ts, src/router/index.ts, src/ai/{context,middleware}.ts
last_reviewed: 2026-05-30
supersedes: framework/archive/phase-1/07-middleware (the ctx.requestId addition), framework/archive/phase-3/10-agents-and-tools (the AiContext.requestId source)
rfc: rfc-bun-random-uuidv7
---

# Spec 19 — Request IDs

This spec encodes [[rfc-bun-random-uuidv7]]. It supersedes the relevant
slices of the archived phase-1 middleware spec and phase-3 agents spec —
specifically the `PattiesContext` shape and the `AiContext.requestId`
source. Everything else in those archived specs remains the spec of
record.

## Goal

Give every request a single, framework-generated correlation id that:

1. User middleware, route handlers, plugins, and the AI subsystem can all
   read (instead of each minting their own).
2. Propagates across an upstream proxy via `X-Request-Id` when a
   well-shaped one is supplied.
3. Sorts chronologically as a plain string (UUIDv7 on Bun, UUIDv4 on
   non-Bun targets — best-effort).

## Surface

### `PattiesContext.requestId`

```ts
export interface PattiesContext {
  // ...all existing fields from framework/archive/phase-1/07-middleware
  requestId: string
}
```

Populated by the outer composer — the same place that already builds
`ctx.url`, `ctx.cookies`, `ctx.json/html/redirect` — _before_ user
middleware runs. User middleware and plugins MUST NOT re-generate it.

### `AiContext.requestId`

`AiContext.requestId: string` is unchanged on the type level. The
in-request framework middleware that builds `ctx.aiContext` now reads
`pctx.requestId` instead of calling `crypto.randomUUID()`. The
programmatic example in `framework/archive/phase-3/10-agents-and-tools`
becomes:

```ts
const ctx = createAiContext({ requestId: Bun.randomUUIDv7() })
```

## Framework behaviour

### Generation

In the Bun adapter (`src/adapters/bun/`):

```ts
const inbound = req.headers.get("x-request-id")
const requestId = inbound && /^[A-Za-z0-9._-]{8,128}$/.test(inbound)
  ? inbound
  : Bun.randomUUIDv7()
```

In the edge adapter (`src/adapters/edge/`): same logic, but
`crypto.randomUUID()` replaces `Bun.randomUUIDv7()` (W3C-edge platforms
don't expose a v7 helper). The id is still a string; time-ordering is
best-effort across targets.

Inbound header values that don't match the regex are ignored (not echoed
back); a fresh id is generated instead. This stops control characters
and oversize payloads from reaching log lines.

> **Implementation note (shipped 91848f2).** Generation was centralized in
> the unified composer rather than duplicated per adapter: `makeContext`
> calls `resolveRequestId(req)` (`src/middleware/request-id.ts`), whose
> `generateRequestId()` feature-detects the runtime — `Bun.randomUUIDv7()`
> when `globalThis.Bun` exposes it, else `crypto.randomUUID()` (UUIDv4) on
> edge/workerd. Both `bun` and `edge` targets share the `makeContext` +
> router-finalizer path, so the behaviour is identical to the per-adapter
> sketch above; the edge UUIDv4 path is covered by
> `tests/adapters/edge.test.ts`.

### Response echo

The response finalizer — the same code path that flushes `Set-Cookie`
headers — sets `X-Request-Id: <ctx.requestId>` on the outgoing
`Response`, including the 404 fallback and error responses, **unless**
the handler/middleware already set the header. We never overwrite.

### Boot-time use

`ctx.requestId` is request-scope only. Boot code (`app/server.ts`
top-level) has no request and must mint its own id if it needs one
(`Bun.randomUUIDv7()` directly).

## User contract

Logging middleware can use the id directly:

```ts
export default defineMiddleware(async (req, ctx, next) => {
  const start = performance.now()
  const res = await next()
  console.log(ctx.requestId, req.method, ctx.url.pathname, res.status,
    `${(performance.now() - start) | 0}ms`)
  return res
})
```

Handlers that want to set their own `X-Request-Id` (e.g. proxying to a
downstream service that requires a specific format) simply set it on
the returned `Response` — the finalizer leaves it alone.

## Non-goals

- **W3C `traceparent` / OTel propagation.** Out of scope; the request
  id is a single opaque string, not a trace context. A future
  observability RFC may add propagation.
- **Signing / HMAC.** The id is informational, not a security
  primitive.
- **Per-route override of generation strategy.** One generator per
  adapter. Apps that need their own scheme can read inbound headers
  themselves in user middleware and stash on `ctx.vars`.

## Acceptance criteria

- A request with no inbound `X-Request-Id` populates `ctx.requestId` with
  a UUIDv7 (on Bun) and the response carries the same value in its
  `X-Request-Id` header.
- A request with an inbound `X-Request-Id` matching the allowlist regex
  causes `ctx.requestId` to equal that value; the response echoes it.
- A request with an inbound `X-Request-Id` _not_ matching the regex is
  treated as if no header was present.
- A handler that sets its own `X-Request-Id` on the response sees the
  framework leave it unchanged.
- On the edge adapter, `ctx.requestId` is a `crypto.randomUUID()`
  (UUIDv4) string when no inbound header is present.
- When agents are present, `ctx.aiContext.requestId === ctx.requestId`
  for the same request.
- Removing the entire `app/middleware.ts` does not change any of the
  above — generation happens in the outer composer, not in user
  middleware.

## Test plan

- Unit: outer composer fed a `Request` with no header → assert
  `ctx.requestId` matches a UUIDv7 regex and response has matching
  header.
- Unit: same, but with inbound `X-Request-Id: 0123abcd` → assert
  passthrough on both sides.
- Unit: inbound `X-Request-Id: <bad chars>` → assert generated id,
  inbound value not echoed.
- Unit: handler that returns a `Response` with its own `X-Request-Id`
  → assert finalizer preserves it.
- Integration: agent fixture asserts
  `ctx.aiContext.requestId === ctx.requestId`.
- Adapter parity: edge adapter test asserts the same surface using
  `crypto.randomUUID()`.

## Out of this spec

The CLI side (`patties dev` log formatting that may want to prefix lines
with the request id) is unchanged by this spec and remains in
`cli/archive/07-logging-errors.md`.
