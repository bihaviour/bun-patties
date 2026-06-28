---
rfc: bun-transpiler
title: Bun.Transpiler — on-demand single-file TS/TSX transpile
status: backlog
verdict: defer
opened: 2026-05-27
reviewed: 2026-05-27
bun_unique: Bun-faster
host_subsystem: framework/phase-1/04-build (covered by Bun.build today)
comparable_elsewhere: Next.js uses SWC for on-demand transpile in `next dev`; Babel before that. Vite uses esbuild for transpile, Rollup for bundle.
trigger_to_pickup: We need to transpile a single file outside of a build (e.g. REPL endpoint, eval route, on-demand route compile in a custom dev server).
---

# RFC — Bun.Transpiler (backlog)

## Summary
`Bun.Transpiler` returns a transpiler instance that runs TS→JS / JSX→JS per file without wrapping into a build graph. Faster than SWC for many workloads; sync API.

## Why backlog
`Bun.build` already handles transpile end-to-end for our build, dev-bundler (spec 18), and edge adapter. There is no current spec slot for raw per-file transpile.

## Trigger to promote to draft
A feature appears that needs file-level transpile decoupled from bundling — e.g. an `eval`/REPL endpoint, a custom dev tool, or a plugin that wants to transpile arbitrary user-supplied source.

## Bun-unique classification
**Bun-faster** — Node has SWC (via `@swc/core`) and Babel; Bun's transpiler is materially faster but capability is not new.

## Open questions when promoted
- Does the transpiler need to share macro/import-attribute config with `Bun.build`?
- Would we expose it through a plugin hook or a direct framework API?
