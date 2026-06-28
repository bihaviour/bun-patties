---
rfc: bun-path-url
title: Bun.fileURLToPath / Bun.pathToFileURL — file URL ↔ path
status: out-of-scope
verdict: out-of-scope
opened: 2026-05-27
reviewed: 2026-05-31
moved_to_oos_on: 2026-05-31
bun_unique: Standard
host_subsystem: none — framework currently uses string paths
comparable_elsewhere: `node:url.fileURLToPath` / `node:url.pathToFileURL` — same surface, standardized.
trigger_to_pickup: None — identical to `node:url`, so even if a future spec needs a file-URL round-trip it would `import { fileURLToPath } from "node:url"` at the use site. Nothing for patties to own or wrap.
---

# RFC — Bun.fileURLToPath / pathToFileURL (out-of-scope)

## Out-of-scope (2026-05-31)
**Moved backlog → out-of-scope.** Identical surface to `node:url` with no
Bun-specific advantage — there is nothing for patties to own. If a future spec
ever needs a `file://` ↔ path round-trip, it inlines `node:url` at that one call
site. Permanent no.

## Summary
Convert between `file://` URLs and OS paths. Mirrors `node:url` functions.

## Why backlog
Framework uses string paths from `Bun.Glob` and config-relative resolution. No code path round-trips file URLs today.

This entry is borderline **out-of-scope**: identical surface to Node, no value-add beyond convenience.

## Trigger to promote to draft
- Plugin loader needs to resolve relative imports from a plugin file's `import.meta.url`, OR
- Edge adapter starts dealing with file URLs from a different runtime.

## Bun-unique classification
**Standard** — identical to `node:url`. No Bun-specific advantage; if we ever need this, importing from `node:url` is fine.

## Open questions when promoted
- Honestly: do we ever ship this, or just `import { fileURLToPath } from "node:url"` at the use site?
