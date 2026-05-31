---
"patties": minor
---

Add `patties run <task>`: a Bun-native task runner with a content-addressed
output cache and affected detection for workspace monorepos.

`patties run` wraps each `(package, task)` unit with a cache built entirely on
Bun builtins (`Bun.CryptoHasher`, `Bun.Glob`, `Bun.Archive`, `bun:sqlite`,
`Bun.$`, `Bun.spawn`) — no Turborepo/Nx. It walks the workspace in topological
order, computes a conservative nine-component sha256 cache key per task, and on a
hit restores the task's declared outputs and replays its log instead of
re-running. A leaf change rebuilds exactly it and its transitive dependents;
everything else restores from cache.

Declare per-task `inputs` / `outputs` / `env` / `cache` in a `tasks` block in
`patties.config.ts`. Flags: `--filter`, `--affected --since <ref>`, `--no-cache`,
`--force`, and `--dry-run` (which explains every hit/miss and why a key changed).
`patties dev` / `build` are unchanged. Remote caching (`--remote`) is reserved
for a later release.
