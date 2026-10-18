---
spec: cli/21-shadcn-registry
title: Upstream shadcn/ui through `patties add @shadcn/<name>`
status: completed
phase: post-launch
file: cli/commands/add/shadcn.ts, cli/commands/add/source.ts, cli/commands/add/ui-paths.ts, cli/commands/ui/shadcn.ts, patties-ui/src/schema.ts, create-patties/src/ui.ts
last_reviewed: 2026-10-18
rfc: patties-shadcn-whole-tree-hydration
depends_on: [cli/15-registry-distribution, framework/28-whole-tree-hydration]
---

# CLI Spec 21 — shadcn registry adapter

## Purpose

Stamp the canonical shadcn/ui registry into a patties app with the same bytes
`npx shadcn add` would write, through the existing `add` pipeline (one stamper,
same guarantees). Interactivity comes from the page (`export const hydrate =
true`, [framework/28](../../framework/archive/28-whole-tree-hydration.md)), so
the adapter never injects island wrappers.

## Surface

```sh
patties ui init --shadcn          # @/* → ./app/* tsconfig alias + app/lib/utils.ts
patties add @shadcn/dialog        # built-in namespace (new-york-v4 style)
patties add https://…/item.json   # any shadcn registry item URL
patties add ./vendor/item.json    # or a local one
bunx create-patties my-app --ui shadcn
```

`@shadcn` defaults to `https://ui.shadcn.com/r/styles/new-york-v4`;
`config.ui.registries["@shadcn"]` overrides it (mirror / pinned copy).

## Mapping (`add/shadcn.ts`)

| shadcn item | patties |
|---|---|
| `files[].content` | written verbatim; only `@/registry/<style>/{ui,lib,hooks,components}/…` → `@/{components/ui,lib,hooks,components}/…` |
| `registry:ui` | `componentsDir/<file>` |
| `registry:lib` / `hook` / `component` / `block` | `files[].root: "app"` → `app/lib`, `app/hooks`, `app/components` |
| `files[].target` | honored only inside `app/{components,hooks,lib}` (`root: "app"`); routes, config files, dotfiles and anything else are refused |
| `dependencies` (+ bare imports not declared upstream) | `peerDeps`; unversioned ones pinned to `^<npm latest>` (offline keeps `latest`); `package.json` edited, never installed |
| `registryDependencies` (+ `@/registry/…` imports) | resolved depth-first through the same resolver, deduped |
| `cssVars.{theme,light,dark}` | a `shadcn-<name>` token group merged into `tokensFile` |
| — | `island: "no"`, `status: "completed"`, `spec: "shadcn:<source>"` |

Mapped entries are re-validated against `ComponentEntrySchema`; unknown item
types (`registry:style`, `registry:theme`, …) fail loudly. The schema gained
an optional `files[].root` (`components` | `app`); component-only items omit it
so older patties-ui releases still validate them. The stamper confines `app`
files to `components/`, `hooks/`, `lib/` with no dot-segments, for every source
(registry payloads are untrusted even after preview, since `--yes` skips it).

## Guarantees (unchanged from cli/15)

HTTPS only unless `--allow-insecure`; external source previewed and confirmed
(or `--yes`); fetched code is never executed; no install is ever run.

## Scaffolder

`create-patties --ui shadcn` vendors upstream `button` + `dialog` (drift-tested
against the adapter's output), writes `app/lib/utils.ts`, the `@/*` alias, and a
hydrated demo route; it drops the island demo. Scaffolded `patties` /
`patties-ui` ranges are pinned to `^<version>` baked into
`create-patties/src/versions.ts` by `scripts/sync-versions.ts`, which the root
`version` script runs after `changeset version`.

## Tests

`tests/cli/add-shadcn.test.ts`, `tests/integration/shadcn-dialog.test.tsx`
(stamped upstream Dialog opens/closes on a hydrated page),
`create-patties/tests/scaffold.test.ts`.
