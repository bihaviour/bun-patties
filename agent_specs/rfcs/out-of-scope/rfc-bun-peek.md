---
rfc: bun-peek
title: Bun.peek — synchronously introspect a Promise's settled state
status: out-of-scope
verdict: out-of-scope
opened: 2026-05-27
reviewed: 2026-05-31
moved_to_oos_on: 2026-05-31
bun_unique: Bun-only
host_subsystem: none — internal async primitive, no spec slot
comparable_elsewhere: No standard equivalent in Node. Closest: implementing a `PromiseInspector` pattern manually with state tracking.
trigger_to_pickup: None realistic — would require patties to write its own async runtime; the middleware-and-handler model on the engine's microtask queue is sufficient. Internals-only, never a user-facing API.
---

# RFC — Bun.peek (out-of-scope)

## Out-of-scope (2026-05-31)
**Moved backlog → out-of-scope.** An internals-only microtask optimization with
no user-visible benefit unless patties writes its own async runtime — which it
doesn't and won't. No conceivable user-facing API depends on it. Permanent no.

## Summary
`Bun.peek(p)` returns a settled promise's value/error synchronously, or the promise itself if still pending. Lets framework code avoid awaiting promises that have already resolved.

## Why backlog
This is an internals optimization with no user-visible benefit unless the framework writes its own async runtime. Today middleware/handler async lives entirely on the engine's microtask queue.

This entry is borderline **out-of-scope**: framework will likely never expose it.

## Trigger to promote to draft
Framework profiling shows hot-path microtask overhead that `Bun.peek` could eliminate (e.g. the response finalizer reads several promise-typed fields and most have already resolved).

## Bun-unique classification
**Bun-only** — Node has no equivalent. Capability is Bun-specific. But adoption is unlikely.

## Open questions when promoted
- Honestly: should this RFC just be closed and the API stay invisible? Hard to imagine a user-facing API that depends on it.
