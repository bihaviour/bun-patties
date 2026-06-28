---
rfc: bun-smol
title: --smol flag — memory-constrained runtime mode
status: backlog
verdict: defer
opened: 2026-05-27
reviewed: 2026-05-27
bun_unique: Bun-only
host_subsystem: framework/phase-2/12-edge-adapters (edge deploy size/memory tuning)
comparable_elsewhere: Node's `--max-old-space-size` sets an upper bound but doesn't optimize allocator for low memory — opposite knob. Vercel exposes per-function memory size; not a runtime mode. Cloudflare Workers have hard memory limits (128 MB).
trigger_to_pickup: We ship a deploy target with strict memory budgets (small Fly machines, Render small instances, IoT edge boxes) and need to publish a "use --smol" recommendation.
---

# RFC — --smol runtime flag (backlog)

## Summary
`bun --smol` runs Bun with a smaller initial allocator footprint. Trades throughput for memory headroom.

## Why backlog
Patties hasn't published a recommended deploy size yet. Default deploy targets (Cloudflare Workers, generic edge) handle the memory question themselves.

## Trigger to promote to draft
A deploy adapter targets a memory-constrained runtime that the user can choose to opt into (e.g. tiny Fly VMs).

## Bun-unique classification
**Bun-only** — Node has no equivalent runtime mode. `--max-old-space-size` is the opposite direction (upper bound, not lower-allocator tuning).

## Open questions when promoted
- Does this go in `patties.config.ts` as a deploy target option, or is it purely a `bun` CLI flag users add themselves?
- Edge adapter doesn't run Bun, so the flag is meaningless there.
