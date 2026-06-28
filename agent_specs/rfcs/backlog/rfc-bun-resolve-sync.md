---
rfc: bun-resolve-sync
title: Bun.resolveSync — module resolution outside the build context
status: backlog
verdict: defer
opened: 2026-05-27
reviewed: 2026-05-27
bun_unique: Bun-faster
host_subsystem: framework/phase-4/09-plugins (plugin loader — currently leans on Bun.build's native resolver)
comparable_elsewhere: `import.meta.resolve()` (Node 20+, sync in 22+). `require.resolve()` for CJS. Vite has `vite.resolve.resolve`. Webpack's `enhanced-resolve`.
trigger_to_pickup: Plugin authors need to resolve user packages from a different cwd than the build sees, or the plugin loader needs to introspect resolution for diagnostics (e.g. "package not found, looked in X").
---

# RFC — Bun.resolveSync (backlog)

## Summary
`Bun.resolveSync(specifier, parent)` resolves a module specifier to an absolute path using Bun's resolver. Useful outside of `Bun.build`'s native resolution.

## Why backlog
The plugin spec uses `Bun.build`'s plugin slot, which has its own resolver. We don't currently have a use case where userland code needs to do its own module resolution.

## Trigger to promote to draft
- A plugin diagnostic feature ("which package satisfies this peer dep?"), OR
- A scaffold step that inspects a target dependency before installing.

## Bun-unique classification
**Bun-faster** — `import.meta.resolve` covers the same ground on Node 22+; Bun's is faster and has been stable longer. Capability is not unique.

## Open questions when promoted
- Async `Bun.resolve` vs sync — pick one or expose both?
- Conditional exports — do we need to expose the `conditions` argument to plugins?
