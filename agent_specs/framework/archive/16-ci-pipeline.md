---
spec: framework/16-ci-pipeline
title: CI Pipeline
status: completed
phase: 1
file: .github/workflows/ci.yml
last_reviewed: 2026-05-24
---

# Spec 16 — CI Pipeline

Patties is Bun-native and edge-first ([00-overview](./00-overview.md), pillars 1 and 4). The CI pipeline must defend both: it runs entirely on Bun (no Node toolchain in the install/build/test path), and it proves on every PR that the same source builds and boots on each supported edge runtime — `workerd`, Deno Deploy, Vercel Edge, Netlify Edge, and Bun's own edge runtime.

## Goals

1. **Bun is the toolchain.** `bun install`, `bun run build`, `bun test`, `bun run lint`. No `npm`, `pnpm`, `yarn`, `node`, `vitest`, `jest`, or `tsx` in any job. The only exception is the per-adapter test legs that must invoke the target runtime's own CLI (`workerd serve`, `deno serve`, `wrangler dev`, etc.) — those tools are downloaded directly, not via npm.
2. **Edge-neutrality is enforced by CI, not by docs.** Every adapter listed in [12-edge-adapters](./phase-2/12-edge-adapters.md) has its own job that boots the runtime and hits a fixed route-smoke suite. If a PR breaks one adapter, that PR fails — there is no "Bun works, ship it" path.
3. **Build once, fan out.** The build artifact is produced once per commit and downloaded by every downstream job. Tests never rebuild.
4. **One required check.** Branch protection points at a single aggregator job (`ci-pass`). Adding a new check never requires editing branch protection.
5. **Fast PR feedback.** Docs-only changes skip the full matrix. Per-PR concurrency cancels superseded runs.

## Non-goals

- Node.js support legs. There is no Node target ([00-overview](./00-overview.md), non-goal 2); there is no Node matrix.
- Windows matrix. Patties targets Bun and edge runtimes; both are Linux-first in CI. A separate Bun-on-Windows smoke job may be added later if demand appears.
- Native-binary build pipeline. Patties has no Rust component.
- Test timing-based shard balancing. Premature below ~500 tests; revisit when `bun test` walltime exceeds ~5 minutes.
- Flake-rerun jobs. Revisit if/when a flaky test lands.
- Coverage gates. Revisit when there is a target number to enforce.
- Per-PR preview deployments. Local adapter runs cover the same surface without standing up cloud infra.

## Triggers and concurrency

```yaml
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

concurrency:
  group: >-
    ${{ github.event_name == 'pull_request'
        && format('{0}-pr-{1}', github.workflow, github.ref_name)
        || format('{0}-sha-{1}', github.workflow, github.sha) }}
  cancel-in-progress: true
```

- PR runs are keyed per-PR and cancelled on a new push to the branch.
- `push` runs are keyed per-SHA so a release-tag run is never cancelled by a follow-up merge.

## Job graph

```
changes ─┬─► build ─┬─► lint
         │          ├─► typecheck
         │          ├─► test-unit
         │          ├─► test-integration
         │          ├─► test-adapters (matrix: workerd, deno, vercel-edge, netlify-edge, bun)
         │          ├─► test-plugins   (matrix: per first-party plugin)
         │          └─► check-agents-md
         └─► docs-link-check (only when docs-only)
                                                     └─► ci-pass
```

All jobs except `changes`, `docs-link-check`, and `ci-pass` `needs: [build]` and download the `dist` artifact rather than rebuilding.

## Shared setup

A reusable composite action at `.github/actions/setup/action.yml` owns:

1. `actions/checkout@<sha>` with `fetch-depth: 2` (enough for `changes` to diff against the base).
2. `oven-sh/setup-bun@<sha>` reading the Bun version from `.bun-version`.
3. `bun install --frozen-lockfile`, with the Bun install cache keyed on `bun.lockb`.

Every job starts with `uses: ./.github/actions/setup`. No job sets up Node. Adapter jobs additionally install their target runtime — see `test-adapters` below.

## Jobs

### `changes`

Computes which downstream gates apply. Outputs:

- `docs-only` — `true` when every changed path is under `docs/`, `*.md` at repo root, or `.github/ISSUE_TEMPLATE/`.
- `adapters-touched` — `true` when `src/adapters/**`, `src/build/**`, `src/server/**`, or any adapter fixture changed.
- `plugins-touched` — `true` when `src/plugins/**` or `plugins/**` changed.

Implementation: a Bun script at `scripts/ci-changes.ts` that runs `git diff --name-only origin/${{ github.base_ref }}...HEAD` for PRs and `HEAD^...HEAD` for `push`. Pure Bun — no `actions/changed-files` or other Node tools.

### `build`

- `bun run build` — produces `dist/` per [04-build](./phase-1/04-build.md).
- Uploads `dist/` and `AGENTS.md` as artifact `build-output` (retention 1 day).
- Gated on `changes.outputs.docs-only == 'false'`.

This is the only job that runs `Bun.build`. Every downstream job downloads `build-output`.

### `lint`

`bun run lint` — Biome (per [13-conventions](./13-conventions.md) tooling). Reads source, not `dist/`, but still gates on `build` to surface compile errors first.

### `typecheck`

`bun x tsc --noEmit` against the user-facing surface (`patties`, `patties/config`, `patties/ai`, `patties/client`, `patties/plugin`) using the published type-check tsconfig. The framework's `tsconfig.json` requires `"jsx": "react-jsx"`, `"jsxImportSource": "react"` — typecheck must use the same config so JSX resolution mirrors user projects.

### `test-unit`

`bun test tests/unit/` — pure-function tests for the router, config loader, middleware composer, AI context, etc. No HTTP, no filesystem fixtures beyond in-memory ones. Fast (<30s expected).

### `test-integration`

`bun test tests/integration/` — boots `Bun.serve` against the fixture apps under `tests/fixtures/` (see [14-testing](./phase-1/14-testing.md)), exercises real routes, hydrates real islands. This is the canonical "does the framework actually work on Bun" gate.

### `test-adapters`

Strategy matrix. One leg per adapter in [12-edge-adapters](./phase-2/12-edge-adapters.md):

| Adapter | Runtime CLI | Source |
|---|---|---|
| `workerd` | `workerd serve` | `cloudflare/workerd` GitHub releases |
| `deno` | `deno serve` | official Deno install script |
| `vercel-edge` | `workerd serve` with Vercel Edge shims | as above |
| `netlify-edge` | `deno serve` with Netlify shims | as above |
| `bun` | `bun run` against the edge-target build | already installed |

Each leg:

1. Downloads the `build-output` artifact.
2. Installs its target runtime (downloaded directly from upstream releases, pinned by SHA in `scripts/install-runtime-<name>.ts`; no npm).
3. Builds the canonical fixture app at `tests/fixtures/edge-smoke/` against that adapter (`bun run build --adapter <name>`).
4. Boots the resulting Worker module via the runtime CLI on a local port.
5. Runs `bun test tests/adapters/<name>/` — a fixed route-smoke suite (SSR root, island hydration, API GET, API POST, middleware redirect, 404).

Gating: runs always on `push`; on `pull_request` runs always (this matrix is small and load-bearing for pillar 4 — it does not get skipped on PRs).

### `test-plugins`

Strategy matrix over each first-party plugin under `plugins/` (see [09-plugins](./phase-4/09-plugins.md)). Each leg runs the plugin's `build` hook against `tests/fixtures/plugin-smoke/` and asserts the output shape declared in the plugin's contract test.

Gated on `changes.outputs.plugins-touched == 'true' || github.event_name == 'push'`.

### `check-agents-md`

Per [11-agents-md-generator](./phase-3/11-agents-md-generator.md), regenerate `AGENTS.md` from the agents and tools defined in the fixture apps, then:

```sh
bun run generate:agents-md
git diff --exit-code AGENTS.md
```

Fails if the committed `AGENTS.md` is stale. Same pattern Next.js uses for its precompiled-deps drift check.

### `docs-link-check`

Runs only when `changes.outputs.docs-only == 'true'` OR `docs/**` is in the diff. A Bun script (`scripts/check-docs-links.ts`) walks every `.md` under `docs/` and `agent_specs/`, resolves relative links, and fails on broken targets. No network calls.

### `ci-pass`

```yaml
ci-pass:
  needs:
    - changes
    - build
    - lint
    - typecheck
    - test-unit
    - test-integration
    - test-adapters
    - test-plugins
    - check-agents-md
    - docs-link-check
  if: always()
  runs-on: ubuntu-latest
  steps:
    - run: exit 1
      if: ${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}
```

This is the **only** check listed in branch protection. Adding a new job means adding it to `needs:` here — not editing the GitHub branch-protection settings.

## Runner policy

- All jobs run on `ubuntu-latest` unless otherwise noted.
- All third-party actions are pinned by full commit SHA, not by tag. CI will reject PRs that introduce a `@v<n>` reference (enforced by a lint rule in `scripts/check-workflow-pins.ts`, run as part of `lint`).
- No job has `permissions: write-all`. Jobs declare `permissions:` explicitly; the default is `contents: read`.
- No job uses `secrets: inherit` blindly. Secrets are passed explicitly per job; today the only secret-consuming job is the (future) release-publish workflow, which lives in a separate file.

## What CI is not responsible for

- **Releases.** A separate `release.yml` (out of scope for this spec) handles `bun publish` on tag pushes.
- **Dependency updates.** Renovate or Dependabot config, not CI.
- **Security scanning.** A separate `codeql.yml` runs on a schedule, not per PR.
- **Production synthetics.** Patties has no hosted production surface; nothing to synthetically probe.

## Open questions

- **Adapter test depth.** The 6-route smoke is the minimum. Whether we additionally re-run `test-integration` per adapter (expensive: 5× the integration walltime) or rely on the smoke + per-adapter contract tests is unresolved. Recommendation: smoke + contract until an integration-only regression slips, then revisit.
- **`main` vs `next` channel.** Next.js gates on `canary`; we could mirror with a `next` branch and require PRs against `main`. Defer until the project has a release cadence to plan around.
- **Bun version pinning.** `.bun-version` is the source of truth. Open question whether to also matrix against `bun@latest` on `push` to catch upstream regressions early. Recommendation: yes, as a `continue-on-error: true` job that warns but does not block.
