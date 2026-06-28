---
rfc: bun-tcp
title: Bun.connect / Bun.listen — raw TCP
status: out-of-scope
verdict: out-of-scope
opened: 2026-05-27
reviewed: 2026-05-31
moved_to_oos_on: 2026-05-31
bun_unique: Bun-faster
host_subsystem: none — patties is HTTP-only
comparable_elsewhere: `node:net` (Node's `net.createServer` / `net.connect`). Frameworks generally don't expose raw TCP — that's a runtime / lib concern.
trigger_to_pickup: None within patties' identity. Would require patties to stop being an HTTP-only meta-framework and grow a "custom transports" subsystem — a different product. If that ever happens it is a fresh RFC, not a revival.
---

# RFC — Bun.connect / Bun.listen (out-of-scope)

## Out-of-scope (2026-05-31)
**Moved backlog → out-of-scope.** Raw TCP sits one rung *below* where a
meta-framework operates — it's a runtime/library concern. patties is HTTP-first
by identity; the named trigger ("a non-HTTP transport story") would mean becoming
a different product, not picking up a parked feature. Permanent no. Kept as a
discovered-and-dismissed record (pairs with [[rfc-bun-udp]]).

## Summary
Bun's TCP primitives. Lower-level than `Bun.serve`. Useful for hosting non-HTTP protocols.

## Why backlog
Patties is an HTTP-first meta-framework. Raw TCP doesn't fit the current spec set. Adoption would require a new subsystem ("custom transports").

This entry is borderline **out-of-scope**: if we never host non-HTTP protocols, this RFC will move to `rfcs/out-of-scope/`.

## Trigger to promote to draft
A clear non-HTTP use case lands (gRPC, raw socket game server, etc.) and we decide patties wants to own it.

## Bun-unique classification
**Bun-faster** — `node:net` has the same surface; Bun's is faster. Capability isn't unique.

## Open questions when promoted
- Does patties even want to be in this business? (Current stance: no.)
