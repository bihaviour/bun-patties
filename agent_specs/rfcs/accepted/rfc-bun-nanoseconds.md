---
rfc: bun-nanoseconds
title: Bun.nanoseconds — high-resolution clock for Server-Timing
status: encoded
encoded_in: ["framework/archive/20-server-timing"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: dev-dx
affects_specs: [19-request-id, 20-server-timing]
bun_unique: Bun-faster
host_subsystem: framework/archive/19-request-id (response finalizer extension)
comparable_elsewhere: Node has `process.hrtime.bigint()` with the same precision. Next.js emits `Server-Timing` automatically for some internal phases but does not expose a user-controlled API. Hono has a `timing()` middleware.
---

## Review verdict (2026-05-27)

**Accept.** The response finalizer introduced in spec 19 already
mutates outgoing-response headers (X-Request-Id, Set-Cookie flush).
Adding `Server-Timing: total;dur=<ms>` is a two-line addition that
turns the existing finalizer code path into the standard
browser-Network-tab perf indicator. Cost: ~50 lines of new spec,
~10 lines of code. Value: every patties user sees server-side
request duration in their dev tools with no setup.

Scope pins:
- **Dev only.** Production responses must not carry the header (no
  perf leak, no overhead).
- **`total` only.** Single `total;dur=<ms>` entry; named
  per-middleware entries are deferred to a follow-up RFC if real
  demand surfaces.
- **Adapter parity.** Bun adapter uses `Bun.nanoseconds()` (bigint
  ns); edge adapter uses `performance.now()` (double ms). Same
  precision class; identical header shape.
- **Don't overwrite.** A handler that sets its own `Server-Timing`
  header wins; the finalizer leaves it alone. Same rule as
  `X-Request-Id`.

Out of scope for this RFC:
- **Named per-middleware entries.** Would require ctx-threading.
  Re-open under a follow-up RFC if asked.
- **Always-on production timing.** Separate observability concern;
  apps that need it should wire their own middleware.

---

# RFC — Bun.nanoseconds → Server-Timing

## Summary

`Bun.nanoseconds()` returns elapsed nanoseconds since process start
as a `bigint`. Use it in the same response finalizer that already
adds `X-Request-Id` (spec 19) to emit
`Server-Timing: total;dur=<ms>` on every dev response.

## Motivation

Patties dev users currently get no built-in server-timing signal in
their browser dev tools. They have to wire middleware that calls
`performance.now()` and sets the header themselves. Spec 19 opened
the right code path — the outer composer's response finalizer — for
a header that should be on every response. Adding `Server-Timing`
here costs nothing and gives every user a visible perf indicator
from day one.

`Bun.nanoseconds()` is the right primitive on Bun: `bigint`
nanoseconds, no allocation, no `Date.now()` rounding. On edge
adapters, `performance.now()` is the standards-compliant equivalent
and is available in every WHATWG-class runtime.

## Proposal

### Capture timestamps

In the outer composer (the same module that builds `PattiesContext`):

```ts
// Bun adapter
const ns0 = Bun.nanoseconds()
const res = await runRoute(req, ctx)
const ms = Number(Bun.nanoseconds() - ns0) / 1e6
```

```ts
// Edge adapter
const t0 = performance.now()
const res = await runRoute(req, ctx)
const ms = performance.now() - t0
```

### Set the header in dev

The same finalizer that flushes `X-Request-Id` checks `NODE_ENV`:

```ts
if (Bun.env.NODE_ENV !== "production") {
  if (!res.headers.has("Server-Timing")) {
    res.headers.set("Server-Timing", `total;dur=${ms.toFixed(1)}`)
  }
}
```

### Coexist with spec 19

The Server-Timing write happens after the X-Request-Id write in the
finalizer. Both are pure-additive on disjoint header names.

## Trade-offs

- **`.toFixed(1)` reveals server timing shape in dev.** That's the
  point — the developer wants to see it. Prod is unaffected by
  this RFC.
- **Edge adapter precision.** `performance.now()` is
  millisecond-precision-class but actually a double — same
  effective resolution as `Bun.nanoseconds()` rounded to ms.
- **No named entries.** Conscious scope. Easier to ship now and
  add later than to ship a wider API we can't easily walk back.

## Open questions

- Should we also emit Server-Timing in prod when a user opts in
  via config? Deferred — open a follow-up RFC if asked.
- Per-middleware named entries (`auth;dur=...`, `db;dur=...`)?
  Deferred — requires ctx-threading.
