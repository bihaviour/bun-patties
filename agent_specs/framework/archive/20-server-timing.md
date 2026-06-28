---
spec: framework/20-server-timing
title: Server-Timing — dev-only response duration header
status: completed
phase: dev-dx
file: src/middleware/cookies.ts, src/router/index.ts
last_reviewed: 2026-05-30
supersedes: framework/archive/19-request-id (extends, does not replace — the response finalizer also emits Server-Timing alongside X-Request-Id in dev)
rfc: rfc-bun-nanoseconds
---

# Spec 20 — Server-Timing

This spec encodes [[rfc-bun-nanoseconds]]. It extends the response
finalizer introduced in [[framework/archive/19-request-id|spec 19]] so
that every response in dev carries `Server-Timing: total;dur=<ms>`
alongside `X-Request-Id`. Production responses are unchanged.

## Goal

Give the framework a wall-clock duration that shows up in browser
dev-tools without configuration: open the Network panel, look at any
response, see how long the server took. No middleware to install, no
manual instrumentation, no setup in `patties.config.ts`.

## Surface

No new user-facing API. The framework adds one outgoing header in dev:

```
Server-Timing: total;dur=<ms>
```

Where `<ms>` is the wall-clock duration from the moment the outer
composer enters request handling to the moment the response finalizer
is about to flush the response, rendered to one decimal place.

## Framework behaviour

### Timing capture

In the Bun adapter (`src/adapters/bun/`):

```ts
const ns0 = Bun.nanoseconds()
// ...middleware + handler run...
const elapsedNs = Bun.nanoseconds() - ns0
const ms = Number(elapsedNs) / 1e6
```

In the edge adapter (`src/adapters/edge/`):

```ts
const t0 = performance.now()
// ...middleware + handler run...
const ms = performance.now() - t0
```

Both produce a double-precision millisecond value; same precision
class for the header.

### Emission

The same response finalizer that flushes `X-Request-Id` and
`Set-Cookie` checks `NODE_ENV` and adds the header:

```ts
if (Bun.env.NODE_ENV !== "production") {
  if (!res.headers.has("Server-Timing")) {
    res.headers.set("Server-Timing", `total;dur=${ms.toFixed(1)}`)
  }
}
```

The detection rides on the same `NODE_ENV` check the dev error
overlay uses. No new config knob.

### Header coexistence with spec 19

The Server-Timing write happens **after** the X-Request-Id write.
Both are pure-additive on disjoint header names; neither blocks the
other.

A handler that has already set `Server-Timing` itself wins — the
finalizer never overwrites an existing `Server-Timing` header. Same
rule pattern as the X-Request-Id contract.

> **Implementation note (shipped 91848f2).** Timing and emission live in
> the shared `finalizeResponse` (`src/middleware/cookies.ts`), invoked from
> the router (`src/router/index.ts`) for both per-route handlers and the
> 404 fallback. Capture rides a `now()` helper that feature-detects the
> runtime — `Number(Bun.nanoseconds()) / 1e6` on Bun, else
> `performance.now()` on edge — and `isProduction()` reads `NODE_ENV` from
> `Bun.env` or `process.env`. The per-adapter sketch above is collapsed
> into this one path; the edge shape is covered by
> `tests/adapters/edge.test.ts`.

## User contract

In dev, every response has a `Server-Timing: total;dur=...` header.
In prod, nothing changes — no header, no overhead.

A handler that wants to add its own entries can do so by setting its
own `Server-Timing` header on the returned `Response`; the finalizer
sees the existing header and skips its own write.

## Non-goals

- **Named per-middleware entries.** Out of scope. Adding
  `auth;dur=...` / `db;dur=...` would require ctx-threading and a
  `ctx.timing` API; if real demand surfaces, open a follow-up RFC.
- **Production timing.** Out of scope. Apps that need prod timing
  should wire their own observability middleware that reads
  `Bun.nanoseconds()` / `performance.now()` directly.
- **Sub-millisecond precision.** `.toFixed(1)` is the contract;
  clients that read more decimals will be disappointed.
- **A dedicated `serverTiming` config knob.** The dev/prod gate is
  the only switch. If users want to opt out entirely in dev, they
  can set their own `Server-Timing` header to an empty value in
  middleware.

## Acceptance criteria

- In dev, a request to any route returns a response with a
  `Server-Timing: total;dur=<X.Y>` header where `<X.Y>` is a positive
  number rendered to one decimal place.
- In prod (`NODE_ENV=production`), the same request returns a
  response with no `Server-Timing` header.
- A handler that sets its own `Server-Timing` header sees the
  framework leave it unchanged in both dev and prod.
- On the edge adapter, dev mode still produces a `Server-Timing`
  header using `performance.now()`; the header shape is identical.
- The header coexists with `X-Request-Id` (spec 19); both appear on
  the same response with no interference.

## Test plan

- Unit: outer composer in dev → assert `Server-Timing` header
  present and matches `^total;dur=\d+\.\d$`.
- Unit: same with `NODE_ENV=production` → assert header absent.
- Unit: handler returning a response with its own `Server-Timing`
  header → assert finalizer preserves it verbatim.
- Adapter parity: edge adapter test asserts same shape via
  `performance.now()`.
- Integration: a request also carries `X-Request-Id` per spec 19 —
  assert both headers appear on the same response.

## Out of this spec

The dev error overlay (`src/render/dev-error-overlay.ts`) and the
CLI log formatting (`cli/archive/07-logging-errors`) are unaffected.
