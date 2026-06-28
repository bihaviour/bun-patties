# shadcn/ui → patties-ui Parity Matrix

- **Goal:** reach the same "scaffold UI" developer experience as shadcn/ui — copy-in component source, a CLI that stamps files + helpers + deps, a theming token model, and a registry — but Bun-native and SSR-first.
- **shadcn source:** `https://ui.shadcn.com/docs/cli`, `https://ui.shadcn.com/llms.txt`
- **patties source of truth:**
  - CLI impl: `bun-patties-framework/packages/patties/src/cli/commands/add.ts` (+ `add/*`)
  - Catalog package: `bun-patties-framework/packages/patties-ui/` (`src/registry.ts`, `src/types.ts`, `templates/`)
  - Specs: `agent_specs/ui/archive/**` (catalog, all five phases archived) + draft specs under `agent_specs/{cli,ui,framework}/draft/`
- **Last reviewed:** 2026-05-31
- **Last reclassified:** 2026-05-31 (adopted the bun-coverage-matrix status taxonomy: `shipped` / `specced` / `spec-later` / `divergent` / `deferred` / `out-of-scope`, with a per-status `relevant-gap` headline)
- **2026-05-31:** `rfc-patties-ui-theme-editor` moved `rfcs/deferred/` → new `rfcs/out-of-scope/` (`status: out-of-scope`). Re-survey confirmed the visual editor is community/app-level (tweakcn etc.), not shadcn-core; theme distribution already covered by [[rfc-patties-ui-registries]]. `deferred` count 1 → 0; `out-of-scope` 3 → 4 (1 now carries an RFC file).
- **2026-05-29:** removed the three standalone rationale specs for `divergent`/`out-of-scope` rows (`cli/16-search-list`, `cli/18-cli-non-goals`, `ui/61-config-model`). Matching the bun matrix, those statuses carry **no spec/RFC** — the rationale lives inline in the [§ Divergent](#divergent-intentional-design-difference) and [§ Out-of-scope](#out-of-scope-doesnt-apply-to-the-patties-model) tables. Only `specced` / `spec-later` / `deferred` rows have draft specs + RFCs.
- **2026-05-29:** promoted the registry-distribution cluster from `spec-later` → `specced` (4 rows). [[rfc-patties-ui-registries]] moved `rfcs/backlog/` → `rfcs/accepted/` (`status: encoded`). `specced` is now 12, `spec-later` 0; accepted patties-ui RFCs now 8.
- **2026-05-29:** **implemented** the eight scaffold-ergonomics rows (`ui` config block, `--path`, `ui init`, `view`/`--view`, `--diff`/`update`, base-color presets, `@theme inline` wiring, `migrate rtl`/`radix`) — moved `specced` → `shipped` and archived specs `cli/{11,12,13,14,17}`, `framework/25`, `ui/62` (`draft/` → `archive/`, `status: completed`). `shipped` 12 → 20, `specced` 12 → 4 (registry distribution only). Catalog templates still use scattered `@radix-ui/react-*` imports (not yet the unified import) — tracked, see [cli/17 implementation note](../cli/archive/17-migrate-codemods.md).
- **2026-05-30:** **implemented** the registry-distribution cluster (4 rows: `add <url>`/`add <local-path>`, namespaced `@ns/…` registries, remote/URL registries, `patties ui build`) — moved `specced` → `shipped` and archived `cli/15-registry-distribution` (`draft/` → `archive/`, `status: completed`). `shipped` 20 → 24, `specced` 4 → 0. The CLI classifies source kinds in `add/source.ts` (`classifySource` + temp-dir materialization so the existing stamp pipeline is reused unchanged) and fetches/validates via `add/registry-fetch.ts` (HTTPS-only unless `--allow-insecure`, payloads schema-checked against `patties-ui/src/schema.ts`); `patties ui build` emits a fetchable `registry.json` + per-component payloads with inlined source. Bun-native stance kept: fetched source is written verbatim, never executed, and no install is ever run. `patties-ui` is now publishable (`zod` dep + `./schema` export); `ComponentEntrySchema` is the single source of truth (`types.ts` re-derives via `z.infer`).

This catalogue covers every shadcn CLI command, every `add` flag, the `components.json` config keys, the registry/distribution model, the theming surface, and the component catalog. Classification reflects whether patties ships the capability, has a draft spec for it, intentionally diverges, has parked it, or holds it out of scope.

## Summary

| Status | Count | RFC file location | Spec |
|---|---|---|---|
| `relevant-gap` | 0 | — | — (would need a new RFC + draft spec) |
| `shipped` | 24 | — (no RFC — already in code) | `patties` / `patties-ui` |
| `specced` | 0 | — (none currently) | — |
| `spec-later` (backlog) | 0 | — (none currently) | — |
| `divergent` | 9 | — (no RFC — design choice) | rationale inline in [§ Divergent](#divergent-intentional-design-difference) (dark mode also in `ui/archive/62`) |
| `deferred` | 0 | — (none currently) | — |
| `out-of-scope` | 4 | 3 no-RFC + 1 with an RFC (`rfcs/out-of-scope/rfc-patties-ui-theme-editor`, moved 2026-05-31) | rationale inline in [§ Out-of-scope](#out-of-scope-doesnt-apply-to-the-patties-model) |
| **Total catalogued** | **37** | | |

The 8 accepted patties-ui RFCs (`rfc-patties-ui-{update-diff, config-block, add-path, view, init, migrate, theming, registries}`) have all now been **implemented** — one per shipped scaffold capability except theming (encodes both `@theme inline` wiring and base-color presets) and registries (encodes all four registry-distribution rows). No `specced` (accepted-but-unbuilt) rows remain.

Plus the **60-component catalog**, all `shipped` (counted once as a `shipped` row above; the per-phase breakdown is in [§ Component catalog](#component-catalog)).

**As of 2026-05-28 there are no `relevant-gap` rows.** Every shadcn capability that applies to patties is either shipped, recorded as a deliberate divergence, deferred with a re-eval trigger, or out of scope. As of 2026-05-30 there are **0 `specced` rows**: the eight scaffold-ergonomics rows shipped 2026-05-29 and the four registry-distribution rows shipped 2026-05-30. Every accepted parity RFC is now implemented — the remaining buckets are deliberate divergences, one deferral, and out-of-scope items, not pending work.

## How to read the Status column

The taxonomy mirrors `bun-coverage-matrix.md`, including its RFC tree: patties-ui parity decisions are tracked as `rfc-patties-ui-*` RFCs under `rfcs/{accepted,backlog,deferred}/`, each encoding into a draft spec — exactly as the Bun-API RFCs (`rfc-bun-*`) do. (shadcn is the upstream *reference*, not the subject — hence `rfc-patties-ui-*`, never `rfc-shadcn-*`.)

- **`shipped`** — implemented in patties today and exercised by code; no RFC needed. (bun-matrix analog: `covered`.)
- **`specced`** — an **accepted RFC** (`rfcs/accepted/rfc-patties-ui-*`) that has landed in a draft spec, but no code yet. (analog: `encoded`.)
- **`spec-later`** (backlog) — a **backlog RFC** (`rfcs/backlog/`): design on record, useful, not blocking, built on demand. (analog: `rfc-later`/backlog.)
- **`divergent`** — patties intentionally does it differently; a deliberate design choice, not a missing feature. The capability exists in some form, retuned for the Bun-native / convention-over-config / SSR-first model.
- **`deferred`** — a **deferred RFC** (`rfcs/deferred/`): considered and rejected for v1, with an explicit re-evaluation trigger. (analog: `deferred`.)
- **`relevant-gap`** — shadcn has it, patties has neither code nor RFC/spec; would need a new RFC + draft spec. Currently **0**.
- **`out-of-scope`** — a shadcn capability that doesn't apply to the patties model at all; no RFC/spec warranted. (analog: `out-of-scope`.)

## The framing this matrix codifies

patties-ui isn't "shadcn/ui, ported." It's "shadcn's *scaffold experience*, rebuilt knowing the constraints are Bun-native, copy-in, SSR-first, and convention-over-config." That reframing decides the buckets:

- shadcn's **`components.json` config axes** (`aliases`, `style`, `baseColor`, `rsc`, `tsx`, `cssVariables`-on/off, `iconLibrary`) mostly become **`divergent`/`out-of-scope`** — patties replaces config with fixed conventions, exposing only the two paths that genuinely vary per project ([[framework/25-ui-config-block]]).
- shadcn's **eager `npm install`** becomes a **`divergent`** by-design choice: patties edits `package.json` and never runs install (`add.ts:73`) — CI-safe, Bun-native.
- shadcn's **remote/npm registry** model is now **`shipped`** (third-party / URL / namespaced registries + `patties ui build`, [[rfc-patties-ui-registries]] → [cli/15](../cli/archive/15-registry-distribution.md)); **MCP/docs** stays **`out-of-scope`** (patties' agent-manifest system is the analog surface).
- The genuinely-missing scaffold ergonomics — `init`, `--view`, `--diff`/`update`, `--path`, presets, `migrate` — **shipped** (2026-05-29), and remote/URL/namespaced installs + `build` **shipped** (2026-05-30); that was the real parity work.

---

## Shipped (implemented today)

| Capability | Category | shadcn | patties handling |
|---|---|---|---|
| `add <component>` | CLI command | copy source + deps | `patties add <component>`, multi-name, fixed dest (`add.ts:26`) |
| `add --all` | CLI command / flag | stamp everything | filters to `status === "completed"` (`add.ts:55`) |
| positional names | `add` flag | names → install | `parseArgs` collects non-flag args (`add.ts:176`) |
| `--overwrite` → `--force` | `add` flag | overwrite existing | same semantics, renamed; default never-overwrites (stamper skips existing) |
| `--dry-run` | `add` flag | preview plan | prints file plan + dep diff + token/helper plan (`add.ts:107`) |
| `--cwd` (global) | `add` flag | select project root | global CLI flag applies |
| Component registry exists | Registry | `registry.json` (built) | `patties-ui/src/registry.ts` (hand-maintained TS) |
| Typed registry entries | Registry | JSON schema | `ComponentEntry` (`types.ts`): name, spec, phase, kind, island, status, files, peerDeps, helpers, tokens |
| Catalog populated | Registry | ~60 components | 61 entries (`hello` fixture + 60 components), every entry `status: "completed"` |
| Resolved at command time | Registry | from registry URL | `Bun.resolveSync("patties-ui/registry", cwd)` (`load-catalog.ts:20`) |
| CSS-variable tokens | Theming | `--background`, `--primary`… | `templates/tokens.css`, merged idempotently (`tokens.ts`) |
| 60-component catalog | Catalog | ~60 live components | all 60 stamped + registered `completed` (see [§ Component catalog](#component-catalog)) |
| `add --diff` / `update` | CLI command + flag | diff local vs upstream | shipped: line-level unified diff vs installed `patties-ui`; `update` re-stamps with `force`; `--diff --check` is a CI drift gate ([cli/12](../cli/archive/12-add-update-diff.md)) |
| `--path <dir>` | `add` flag | redirect destination | shipped: per-invocation destination; helpers follow, tokens don't; backed by `config.ui.componentsDir` ([cli/14](../cli/archive/14-add-path.md)) |
| `ui` config block | Config model | `components.json` paths | shipped: optional `componentsDir`/`internalDir`/`tokensFile`, `.strict()`, project-root-escape guard ([framework/25](../framework/archive/25-ui-config-block.md)) |
| `view` / `add --view` | CLI command + flag | preview item before install | shipped: metadata header + full template source; source to stdout (pipeable), header to stderr ([cli/13](../cli/archive/13-add-view.md)) |
| `ui init` | CLI command | bootstraps deps, CSS vars, aliases | shipped: merges tokens + `cn` helper + patches deps + prints `@theme inline` snippet (never edits `app.css`) ([cli/11](../cli/archive/11-ui-init.md)) |
| Tailwind v4 `@theme inline` | Theming | yes | shipped: wiring snippet printed by `ui init`; never auto-edits `app.css` ([ui/62](../ui/archive/62-theming-presets.md)) |
| Base-color presets | Theming | `baseColor`, preset system | shipped: stamp-time `--theme neutral\|slate\|stone\|zinc`; idempotent token merge; no `baseColor` key ([ui/62](../ui/archive/62-theming-presets.md)) |
| `migrate` (`rtl`, `radix`) | CLI command | codemods | shipped: `scanImports`-detected scoped-regex rewrites, git-dirty guard, `--dry-run`; for user-authored code ([cli/17](../cli/archive/17-migrate-codemods.md)) |
| `add <url>` / `add <local-path>` | CLI command | install from URL/file | shipped: `classifySource` routes URL/local-path/namespaced/name; non-catalog sources materialized to a temp dir so the stamp pipeline is reused ([cli/15](../cli/archive/15-registry-distribution.md)) |
| Namespaced 3rd-party registries (`@acme/…`) | Registry | yes | shipped: `config.ui.registries` maps `@ns` → https base or local path ([cli/15](../cli/archive/15-registry-distribution.md)) |
| Remote / URL registries | Registry | yes | shipped: HTTPS-only (unless `--allow-insecure`), payloads schema-validated against `patties-ui/schema`, source previewed before stamp unless `--yes`, written verbatim, never executed ([cli/15](../cli/archive/15-registry-distribution.md)) |
| `build` | CLI command / Registry | compile `registry.json` | shipped: `patties ui build --out` emits `registry.json` + per-component JSON with inlined source for 3rd-party authors; pure transform, no network/install ([cli/15](../cli/archive/15-registry-distribution.md)) |

## Specced (draft spec written, awaiting implementation)

_None._ All registry-distribution rows shipped 2026-05-30 ([cli/15](../cli/archive/15-registry-distribution.md), [[rfc-patties-ui-registries]]); every accepted parity RFC is now implemented. The status remains in the taxonomy for future accepted-but-unbuilt work.

## Spec-later (backlog — design on record, build on demand)

_None._ The registry-distribution cluster (remote/URL/namespaced installs + `patties ui build`) was promoted backlog → `specced` on 2026-05-29 and **shipped** on 2026-05-30 — its four rows now sit in the [§ Shipped](#shipped-implemented-today) table and `cli/15` is archived. The status remains in the taxonomy for future parked work.

## Divergent (intentional design difference)

| Capability | Category | shadcn | patties divergence | Rationale |
|---|---|---|---|---|
| eager `npm install` | install behavior | installs deps | edits `package.json`, prints `bun install` reminder, never installs (`add.ts:73`) | Bun-native, CI-safe; refuses `NODE_ENV=production` (`add.ts:34`) |
| `search` / `list` | CLI command | query + `--limit`/`--offset` + namespaces | `--list` prints the full local table (`add.ts:139`); optional name-filter + `--json` | one local registry → pagination is pointless |
| `--config` | `add` flag | point at a `components.json` | no config file to point at; `--cwd` selects the project | nothing to point `--config` at |
| `aliases` | Config model | import-path rewriting | derived from `componentsDir`, not a separate axis | one path knob ([[rfc-patties-ui-config-block]]), not five |
| `tailwind.css` / `cssVariables` | Config model | path + vars on/off | fixed `tokensFile`, CSS-vars always on | a vars-off mode would fork every component |
| `rsc` / `tsx` | Config model | RSC + TS-flavor toggles | always SSR-island, always `.tsx`; no toggles | island model is the hydration boundary |
| `style` / `baseColor` (radix vs base) | Config model | base-library + base-color switch | single style; base color is a token preset, not a library switch | [ui/62-theming-presets](../ui/archive/62-theming-presets.md) covers the preset path |
| Distributed as a package | Registry | npm registry / URLs | stamped components are **copy-in**, never imported from a versioned package; `patties-ui` is publishable but only as the catalog the CLI reads, not a runtime dep | copy-in model; remote/URL/namespaced distribution now shipped ([cli/15](../cli/archive/15-registry-distribution.md)) without making components a versioned import |
| Dark mode | Theming | `.dark` via `next-themes` | `.dark` on `<html>`, zero JS theming dependency | no `next-themes`, no `useTheme` in stamped source. [ui/62](../ui/archive/62-theming-presets.md) |

## Deferred (considered, rejected for v1, with re-eval trigger)

_None currently. (The theme editor moved to out-of-scope on 2026-05-31 — see below.)_

## Out-of-scope (doesn't apply to the patties model)

Most out-of-scope rows carry no RFC (rationale inline). One exception: the theme
editor was written up as a full RFC before being dismissed, so it retains a file
in `rfcs/out-of-scope/`.

| Capability | Category | shadcn | Reason |
|---|---|---|---|
| Theme editor / preset codes (`preset decode/url/open`) | Theming | live editor + shareable preset URLs | [[rfc-patties-ui-theme-editor]] (out-of-scope 2026-05-31) — the *visual editor* is community/app-level (tweakcn, themecn, shadcn/studio), not part of shadcn-core or its CLI. shadcn-core ships only base-color presets + `@theme inline`, already encoded in `ui/62`. Theme *distribution* is already covered by [[rfc-patties-ui-registries]]. If shareable preset codes ever get real demand, that is a fresh registry-adjacent RFC, not a revival of this one. |
| `info` | CLI command | print resolved `components.json` + env | no `components.json` to report; config-loading diagnostics + `--list --json` cover the rest |
| `mcp` / `docs` | CLI command | serve registry over MCP / fetch docs | patties' agent-manifest system (`CLAUDE.md`/`AGENTS.md`) is the analog surface |
| `iconLibrary` | Config model | configurable default icon set | fixed `lucide-react`; copy-in means the user owns and edits the import — a config key would imply indirection that doesn't exist |

---

## Component catalog

The 60-component catalog is fully specced and fully implemented — all `shipped`. The spec index lives in [`agent_specs/ui/archive/00-overview.md`](../ui/archive/00-overview.md) (phases 0–4, all archived).

| Phase | Theme | Components | In `registry.ts` | Template file exists |
|---|---|---|---|---|
| 1 | Zero-JS primitives | 18 | **18** | **18** ✅ |
| 2 | Form primitives + Button | 12 | **12** | **12** ✅ |
| 3 | Radix-backed islands | 21 | **21** | **21** ✅ |
| 4 | Recipes & heavy islands | 9 | **9** | **9** ✅ |
| — | Phase-0 fixture | 1 (`hello`) | 1 | 1 |

Every component is registered with `status: "completed"` and has a stamped template; `patties add <name>` stamps source + `_internal/` helpers + `tokens.css` + peer deps, idempotent on re-run. shadcn parity on the catalog is "full" per spec intent (every component `full` except `Form`/`Toast`, kept as compat).

## Implementation order

Items 1–7 **shipped** on 2026-05-29/30 (all specs archived):

1. ~~**`add --diff` / `update`**~~ — shipped ([cli/12](../cli/archive/12-add-update-diff.md)). The copy-in model's biggest weakness was upstream drift.
2. ~~**`--path` + `ui` config block**~~ — shipped ([cli/14](../cli/archive/14-add-path.md), [framework/25](../framework/archive/25-ui-config-block.md)).
3. ~~**`view` / source preview**~~ — shipped ([cli/13](../cli/archive/13-add-view.md)).
4. ~~**`ui init`**~~ — shipped ([cli/11](../cli/archive/11-ui-init.md)).
5. ~~**Theme presets / base color**~~ — shipped ([ui/62](../ui/archive/62-theming-presets.md)). Stamp-time `--theme <name>`.
6. ~~**`migrate` (rtl, radix)**~~ — shipped ([cli/17](../cli/archive/17-migrate-codemods.md)). For user-authored/imported code.
7. ~~**Remote / namespaced registries + `build`**~~ — shipped 2026-05-30 ([cli/15](../cli/archive/15-registry-distribution.md), [[rfc-patties-ui-registries]]). Source-kind classification + temp-dir materialization, HTTPS-only schema-validated fetch, and `patties ui build` for 3rd-party authors.

## Re-running this audit

```bash
# 1. Refresh shadcn surface
#    CLI:  https://ui.shadcn.com/docs/cli
#    Index: https://ui.shadcn.com/llms.txt   (component list + count)

# 2. Cross-reference against patties code
cd bun-patties-framework
#    CLI surface:
grep -nE '"--[a-z-]+"|runAdd|parseArgs|printList' packages/patties/src/cli/commands/add.ts
#    Registry shape + catalog count:
grep -c 'name:' packages/patties-ui/src/registry.ts
ls packages/patties-ui/templates/*.tsx | wc -l

# 3. Cross-reference against draft specs
cd ../bun-patties-docs
ls agent_specs/cli/draft/ agent_specs/ui/draft/ agent_specs/framework/draft/

# 4. Diff against the RFC tree (mirrors bun-coverage-matrix):
ls agent_specs/rfcs/accepted/rfc-patties-ui-* \
   agent_specs/rfcs/backlog/rfc-patties-ui-* \
   agent_specs/rfcs/deferred/rfc-patties-ui-*

# 5. Re-classify each shadcn capability into:
#    shipped | specced | spec-later | divergent | deferred | relevant-gap | out-of-scope
# 6. A `relevant-gap` row means a missing RFC — open rfcs/draft/rfc-patties-ui-<slug>,
#    accept it (→ rfcs/accepted/), encode into a draft spec under
#    agent_specs/{cli,ui,framework}/draft/, then flip the row to `specced`.
#    Promote backlog → accepted when a trigger fires.
# 7. Keep the summary counts in lockstep with the section tables AND the RFC tree.
```

Reviewer note: the `rfcs/` tree holds **two** RFC families — `rfc-bun-*` (Bun-API coverage, tracked by `bun-coverage-matrix.md`) and `rfc-patties-ui-*` (shadcn-parity, tracked here). shadcn is the upstream *reference*, so the RFCs are named for the patties-ui subject, never `rfc-shadcn-*`. Each `specced`/`spec-later`/`deferred` row above has a matching RFC carrying its verdict + `upstream_shadcn` / `comparable_elsewhere` / trigger metadata in frontmatter, exactly as the Bun RFCs do — so promotions edit one place (the RFC) and update the matrix from it.
