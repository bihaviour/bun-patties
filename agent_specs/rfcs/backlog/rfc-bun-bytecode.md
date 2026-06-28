---
rfc: bun-bytecode
title: --bytecode flag — pre-compile JS to JSC bytecode at build
status: backlog
verdict: defer
opened: 2026-05-27
reviewed: 2026-05-27
bun_unique: Bun-only
host_subsystem: framework/phase-1/04-build (build pipeline — currently emits source bundles)
comparable_elsewhere: **None as a user-facing build flag.** V8 has `code_cache` accessible via `--experimental-vm-modules` and a few obscure flags; Node has no end-user build-time bytecode toggle. Next builds source JS only. Closest: Deno doesn't expose bytecode either; only Bun ships this as a build flag.
trigger_to_pickup: Cold-start benchmarks on the edge / standalone-binary adapter show JS parse time as a meaningful share of startup latency.
---

# RFC — --bytecode build flag (backlog)

## Summary
`bun build --bytecode` pre-compiles JS to JavaScriptCore bytecode and embeds it in the bundle. Cuts parse time at startup.

## Why backlog
Patties build spec doesn't expose `--bytecode` today. There's no measured cold-start issue that justifies the added pipeline complexity.

## Trigger to promote to draft
- Edge adapter cold-start benchmarks show JS parse time as ≥ 20% of startup, OR
- Single-binary deploy (`--compile`) latency-sensitive use case.

## Bun-unique classification
**Bun-only** — as a user-facing build-time flag this doesn't exist on Node. Next.js can't ship the equivalent because V8 doesn't expose it that way.

## Open questions when promoted
- Source maps interaction — does `--bytecode` retain SourceMappingURL?
- Per-target opt-in (bun adapter on, edge adapter off when target runtime doesn't support JSC bytecode) — likely Bun-target only.
- Build-time cost vs runtime savings — measure before claiming.
