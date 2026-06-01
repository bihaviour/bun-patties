# patties

## 0.1.0

### Minor Changes

- 748b2d7: Add `patties run <task>`: a Bun-native task runner with a content-addressed
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

- b893f36: Add `patties doctor`: a read-only project hygiene report. Runs and contextualizes `bun audit` / `bun outdated`, adds patties-specific checks (config validity, single-React invariant in monorepos), and prints one aligned report with a concrete remedy per finding. Composed from Bun builtins (`Bun.which`, `Bun.$`, `Bun.stringWidth`/`stripANSI`/`wrapAnsi`). Exit codes: 0 pass / 1 fail / 2 cannot-run.

### Patch Changes

- ffa0b2b: Add an "update available" banner and a `patties upgrade` command.

  The CLI now prints a cached, channel-aware banner on startup when a newer
  `patties` is published, and `patties upgrade` bumps the project's dependency to
  the newest release on its channel (`bun add patties@<latest|next|…>`). The
  banner reads from a local cache and refreshes in the background, so it never
  blocks the CLI; opt out with `--no-update-check` or `NO_UPDATE_NOTIFIER`.

- ffa0b2b: Make dev-server bin + React resolution workspace-aware so Bun-workspace monorepos (hoisted root `node_modules`) load a single copy of React and don't crash SSR with "Invalid hook call". Flat-app resolution is unchanged.
- a99d1bf: Make `patties-ui` truly optional at the CLI: the `add` / `ui` / `view` /
  `update` catalog commands (the only modules that import `patties-ui`) are now
  lazy-loaded in the command dispatcher, so `patties dev` / `build` / `deploy` /
  `secret` no longer fail with "Cannot find module 'patties-ui/schema'" in
  projects that don't depend on the UI catalog (e.g. backend or `--no-ui`
  projects scaffolded by create-patties).

## 0.0.12-next.0

### Patch Changes

- ffa0b2b: Add an "update available" banner and a `patties upgrade` command.

  The CLI now prints a cached, channel-aware banner on startup when a newer
  `patties` is published, and `patties upgrade` bumps the project's dependency to
  the newest release on its channel (`bun add patties@<latest|next|…>`). The
  banner reads from a local cache and refreshes in the background, so it never
  blocks the CLI; opt out with `--no-update-check` or `NO_UPDATE_NOTIFIER`.

- ffa0b2b: Make dev-server bin + React resolution workspace-aware so Bun-workspace monorepos (hoisted root `node_modules`) load a single copy of React and don't crash SSR with "Invalid hook call". Flat-app resolution is unchanged.
- a99d1bf: Make `patties-ui` truly optional at the CLI: the `add` / `ui` / `view` /
  `update` catalog commands (the only modules that import `patties-ui`) are now
  lazy-loaded in the command dispatcher, so `patties dev` / `build` / `deploy` /
  `secret` no longer fail with "Cannot find module 'patties-ui/schema'" in
  projects that don't depend on the UI catalog (e.g. backend or `--no-ui`
  projects scaffolded by create-patties).

## 0.0.8

### Patch Changes

- 67ab8ce: Internal: move framework source from the repo root into
  `packages/patties/` so the framework participates in changesets-managed
  releases. The repo root is now a private workspace shell; both
  `patties` and `create-patties` live under `packages/*` and are
  discovered uniformly by changesets and `bun --filter`.

  No public API changes. The published tarball still ships `src/`,
  `bin/`, `AGENTS.md`, `README.md`, and `CHANGELOG.md` at the same
  relative paths inside the package.

## 0.0.3

### Patch Changes

- Ship phase 4: plugin system (`patties/plugin` subpath). Adds `definePlugin`, `PluginServer.route`/`use`, `Bun.semver`-based compat checks, and hooks for build, dev, agents-md, and jobs.

## 0.0.1

### Patch Changes

- Initial release.
