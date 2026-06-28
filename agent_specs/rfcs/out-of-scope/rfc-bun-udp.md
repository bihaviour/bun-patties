---
rfc: bun-udp
title: Bun.udpSocket — UDP sockets
status: out-of-scope
verdict: out-of-scope
opened: 2026-05-27
reviewed: 2026-05-31
moved_to_oos_on: 2026-05-31
bun_unique: Bun-faster
host_subsystem: none — patties is HTTP-only
comparable_elsewhere: `node:dgram`. Frameworks don't expose UDP.
trigger_to_pickup: Same as [[rfc-bun-tcp]] — none within patties' HTTP-only identity.
---

# RFC — Bun.udpSocket (out-of-scope)

## Out-of-scope (2026-05-31)
**Moved backlog → out-of-scope** alongside [[rfc-bun-tcp]] (same reasoning —
non-HTTP transport is outside patties' identity). Permanent no.

## Summary
UDP socket primitive. Game state sync, DNS-style protocols, multicast. Same shape as [[rfc-bun-tcp]] — different transport.

## Why backlog
HTTP-only meta-framework. No spec slot. Borderline **out-of-scope**.

## Trigger to promote to draft
Same as TCP — a real non-HTTP use case lands.

## Bun-unique classification
**Bun-faster** — `node:dgram` covers the same ground; Bun's is faster.

## Open questions when promoted
- Probably ships (or doesn't) together with `rfc-bun-tcp`.
