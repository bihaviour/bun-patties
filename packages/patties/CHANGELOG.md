# patties

## 0.1.0

### Minor Changes

- 6e0d4a2: Add an "update available" banner and a `patties upgrade` command.

  The CLI now prints a cached, channel-aware banner on startup when a newer
  `patties` is published, and `patties upgrade` bumps the project's dependency to
  the newest release on its channel (`bun add patties@<latest|next|…>`). The
  banner reads from a local cache and refreshes in the background, so it never
  blocks the CLI; opt out with `--no-update-check` or `NO_UPDATE_NOTIFIER`.

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
