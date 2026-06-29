---
rfc: patties-shadcn-whole-tree-hydration
title: patties-shadcn — verbatim shadcn/ui via opt-in whole-tree page hydration
status: proposed
verdict: pending
opened: 2026-06-29
upstream_shadcn: "shadcn/ui canonical registry (ui.shadcn.com/r), `npx shadcn add`, `\"use client\"` boundary model"
comparable_elsewhere: "TanStack Start client-first whole-tree hydration (hydrateRoot at the app root); Next.js App Router server-first `\"use client\"` opt-in"
host_subsystem: "framework — new opt-in page-hydration render/build path; plus a `patties-shadcn` UI registry package"
depends_on: [patties-ui-registries, patties-ui-config-block]
relates_to: ["framework/06-client-islands", "ui/00-overview"]
---

## Summary

Add an **opt-in, page-level whole-tree hydration mode** to patties (TanStack
Start-style: one `hydrateRoot` over the page's React subtree), and ship a
**`patties-shadcn`** package that stamps the *canonical, upstream* shadcn/ui
source **verbatim** into a patties app. Because a hydrated page reconnects the
entire component tree on the client, upstream shadcn components — including
`"use client"` files, function props (`onClick`, `onValueChange`), and composed
siblings sharing React context (`<DialogTrigger>` + `<DialogContent>`) — "just
work" without the per-island wrapper or JSON-prop boundary that the current
island model requires.

`patties-shadcn` is **additive UI support** alongside the first-party
`patties-ui` catalog. The goal is explicit: let users keep the maturity and
convenience of upstream shadcn/ui (and `npx shadcn`-style ergonomics) without
leaving patties.

## Motivation

Today patties has exactly one hydration model: **islands**
(`framework/06-client-islands`). Each `[data-island]` marker gets its own
`hydrateRoot`, props cross the SSR→client boundary as **JSON only**
(`render/island.tsx`: `JSON.stringify(props ?? {})`), and only files under
`app/islands/**` that are wrapped in `<Island name=…>` ever hydrate
(`build/scan-islands.ts`, `client/index.ts`).

This is great for SSR-first, ship-only-what-you-need apps. But it is hostile to
**verbatim upstream shadcn**:

- shadcn components ship `"use client"`, which patties **ignores** — they SSR but
  never hydrate on their own.
- shadcn relies heavily on **function props** and **shared React context across
  composed subcomponents**, both forbidden across the island JSON boundary.
- Using upstream shadcn today therefore means hand-wrapping every interactive
  composition into an `app/islands/` file — losing the copy-paste convenience
  that is shadcn's entire value proposition.

The user-facing ask: *use the real shadcn/ui, with its real ergonomics, inside
patties.* The cleanest way to honor that is to give pages a hydration mode where
the boundary problem does not exist — i.e. hydrate the whole tree, the way
TanStack Start does.

## Goals

- A page can **opt into** whole-tree hydration; its entire React subtree
  hydrates as a single root.
- Upstream shadcn components stamp and run **verbatim** inside a hydrated page —
  no island wrappers, no JSON-prop restriction, `"use client"` is a harmless
  no-op.
- `patties-shadcn` resolves the canonical shadcn registry and stamps source into
  `app/components/ui/`, reusing the existing `add` stamper + `ui.registries`
  plumbing.
- **Coexistence:** islands and zero-JS SSR pages keep working unchanged. Whole-
  tree hydration is never the default.
- Stays **Bun-native** (`Bun.build`, `Bun.Glob`, `Bun.serve`) and works on both
  `bun` and `edge` targets.

## Non-goals

- Replacing the island model. Islands remain the default and the recommended
  path for mostly-static pages.
- React Server Components / server actions. This is classic SSR + client
  hydration, not RSC.
- Making the **whole app** an SPA by default. Hydration is per-page opt-in.
- Forking shadcn. `patties-shadcn` distributes a *mapping/adapter* over the
  upstream registry, not a vendored copy.

## Architectural tension (read before accepting)

This RFC **knowingly diverges** from two stated project rules and must be
accepted as an explicit, opt-in carve-out:

1. `.claude/rules/ui-catalog.md` / `ui/00-overview` — "SSR-first, island by
   opt-in; ship only what's needed." A hydrated page ships its full component
   tree to the client. **Mitigation:** opt-in per page; default behavior
   (zero-JS / island-only) is unchanged. Document the carve-out in the UI rule.
2. `.claude/rules/build-time-discovery.md` — still **honored**: all discovery,
   entry generation, and bundling happen at build time; the production server
   bundle does not scan the filesystem at runtime. Per-page client bundles are
   produced during `build`, exactly like island bundles are today.

The single-React-copy invariant (`patties dev --preserve-symlinks`) becomes
*more* important, not less, and is reused as-is.

---

# Part A — Whole-tree page hydration (framework)

## Current pipeline (what we build on)

- `render/shell.tsx` wraps every page as
  `<html><head/><body><div id="root">{Page}</div>{clientScript}</body></html>`.
- `render/index.tsx` already selects a per-route client script:
  `manifest.byEntry?.[entry.bunPattern] ?? manifest.entry`. **This is the hook.**
  Hydrated pages set `byEntry[route] = <page chunk url>`.
- `client/index.ts` currently hydrates island markers. We add a sibling client
  runtime for page-root hydration.
- `build/client-entry.ts` generates the island-registration entry. We add a
  per-page entry generator.

## Public surface (app author)

Opt in per page via a module export (mirrors the existing `island`/`meta`/`head`
export convention):

```tsx
// app/routes/dashboard.tsx
export const hydrate = true;          // opt this route into whole-tree hydration
export default function Dashboard(props) { /* shadcn components used freely */ }
```

Optional config default for an app that wants it broadly:

```ts
// patties.config.ts
export default defineConfig({
  render: { hydrate: "off" | "pages" },   // default "off"
});
```

`"pages"` flips the default so every route hydrates unless it exports
`hydrate = false`. Default remains `"off"` — zero behavior change for existing
apps.

## SSR → client bootstrap

The client must reproduce the **same props** the server rendered with, or React
throws a hydration mismatch. patties pages render with `{ ...ctx.params }`
(`render/index.tsx:99`). For hydrated pages we additionally serialize a
**bootstrap payload** into the HTML:

```html
<script type="application/json" id="__patties_bootstrap">
  {"params":{"id":"42"},"data":{ /* serialized loader output, if any */ }}
</script>
```

- Phase 1: payload = route params only (already JSON, already available).
- Phase 2: payload also carries a page-level `loader()` result. We need a single
  serialization contract; default JSON, with an optional `serialize`/`deserialize`
  hook per page for non-JSON types (Date/Map/Set) — same escape hatch the island
  spec already names. **Note:** unlike the island boundary, *function props
  between components inside the page are fine* — they never cross the wire; only
  the page's top-level bootstrap is serialized.

## Per-page client entry (generated at build)

```ts
// generated: dist/client/pages/<route-hash>.entry.ts
import { hydratePage } from "patties/client";
import Page from "<abs path to app/routes/dashboard.tsx>";
hydratePage(Page, "#root", "#__patties_bootstrap");
```

`hydratePage` (new export in `client/index.ts`):

```ts
export function hydratePage(Page, rootSel, bootstrapSel) {
  const el = document.querySelector(rootSel);
  const raw = document.querySelector(bootstrapSel)?.textContent ?? "{}";
  const { params, data } = JSON.parse(raw);
  hydrateRoot(el, React.createElement(Page, { ...params, ...(data ? { data } : {}) }));
}
```

Hydrating `#root` (the page subtree) — **not** `<html>` — keeps `<head>`, the
bootstrap blob, and the module script outside the React root, matching how the
island runtime already avoids hydrating chrome.

## Build changes

- `build/scan-routes` (existing) gains a per-route flag: does the page module
  export `hydrate` truthy (or is config `render.hydrate === "pages"` and not
  opted out)? Read statically at build via the already-imported module.
- New `build/page-entry.ts` (sibling to `client-entry.ts`): for each hydrated
  route, emit the entry above. `Bun.build` bundles the page + its transitive
  component imports (shadcn, `cn`, radix) into a route chunk. React is hoisted to
  the shared runtime chunk (same code-splitting that islands rely on).
- `build/index.ts`: write `manifest.byEntry[route.bunPattern] = <chunk url>` for
  hydrated routes. Non-hydrated routes stay untouched (zero JS / island entry).
- `adapter.bun.compile` / `edge`: page chunks embed via the existing
  `with { type: "file" }` / `Bun.embeddedFiles` path used for island chunks. No
  new runtime FS access.

## Renderer changes

`render/index.tsx`:

- When a route is hydrated, emit the `__patties_bootstrap` script inside
  `<body>` (before the module script) and ensure `clientScriptUrl` resolves to
  the page chunk (already does, via `byEntry`).
- `<Island>` markers still render if the page also uses islands, but on a
  hydrated page they are redundant (the tree hydrates wholesale). Document this;
  optionally warn in dev when both are present on one route.

## Coexistence matrix

| Page kind | Client JS shipped | Hydration | shadcn usage |
|---|---|---|---|
| Default (today) | none | none | static shadcn only (SSR markup) |
| Island page (today) | island chunk(s) | per-marker `hydrateRoot`, JSON props | interactive shadcn must be island-wrapped |
| **Hydrated page (new)** | page tree chunk | one `hydrateRoot` on `#root` | **verbatim shadcn, function props + context OK** |

## Edge + bundle considerations

- Edge target: SSR is unchanged (`renderToReadableStream`); only the extra
  bootstrap script + a static chunk URL are added. Compatible.
- Bundle size: hydrated pages ship more JS by design. Document it. Code-splitting
  shares React across routes; per-route chunks keep one heavy page from taxing
  others. `patties build` should report per-route client bytes so the cost is
  visible (ties into `doctor`).

---

# Part B — `patties-shadcn` package (UI support)

## What it is

A distributable **registry adapter** + thin CLI shim that makes the canonical
shadcn/ui catalog stampable in patties. It is consumed through the existing
`add` + `ui.registries` machinery (`rfc-patties-ui-registries`), so there is no
second stamper to maintain.

## Registry resolution

Two supported entry points:

1. **Config-driven (lightest):** map a namespace to shadcn's registry base.
   ```ts
   ui: { registries: { "@shadcn": "https://ui.shadcn.com/r" } }
   ```
   Then `patties add @shadcn/dialog`.
2. **Package-driven:** installing `patties-shadcn` registers the `@shadcn`
   namespace (and any pinned mirror/version) by default, and exposes a
   `patties-shadcn` schema mapping so first-time setup is one install.

## Schema mapping (the core deliverable)

shadcn registry JSON ≠ patties `ComponentEntrySchema`. The adapter maps:

| shadcn registry field | patties target |
|---|---|
| `files[].path` with `@/` targets | rewrite to `ui.componentsDir` / `internalDir` |
| `files[].content` (verbatim, incl. `"use client"`) | written as text, **never executed** (preserves the CI-safe invariant) |
| `dependencies` (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `radix-ui`/`@radix-ui/*`, `tw-animate-css`) | `peerDeps` — `package.json` edited, **no install run** |
| `cssVars` / `tailwind` | merged into `ui.tokensFile` (`tokens.css`), reusing the theming pipeline |
| `registryDependencies` | resolved transitively through the same mapper |
| `type: registry:ui/lib/hook` | `kind` + destination dir |
| *(absent)* `island` | **set `island: "off"`** — hydration handled by the page, not per-component |

Validation: mapped entries are checked against `ComponentEntrySchema` before
stamping; source is **previewed then written verbatim**, HTTPS-only, http
rejected without `--allow-insecure` — identical guarantees to
`rfc-patties-ui-registries`.

## Why whole-tree hydration is the enabling dependency

With Part A, the mapper does **not** need to inject `island` exports, generate
island wrappers, or rewrite shadcn's function-prop composition. It rewrites
import paths, merges tokens, and patches peer deps — nothing else. The stamped
file is byte-for-byte upstream shadcn (modulo the `@/` alias). That is what keeps
users on shadcn's "maturity + convenience" with zero patties-specific authoring.

## Path alias

Stamp with patties-relative imports by default, **or** (recommended for maximal
verbatim fidelity) document adding `paths: { "@/*": ["./app/*"] }` to
`tsconfig.json` so upstream `@/components/ui/*` and `@/lib/utils` resolve
unchanged. `patties-shadcn init` can offer to write this alias + an
`app/lib/utils.ts` re-export of the existing `_internal/cn`.

## Theming

Reuse the Tailwind v4 + CSS-variable pipeline (`app/styles/tokens.css`,
`@theme inline` in `app.css`, `.dark` class). shadcn `cssVars` merge into
`tokens.css`; the existing `--theme neutral|slate|stone|zinc` presets still
apply.

---

## Implementation plan (phased — maps to the tracking issue)

**Phase 0 — Spec & RFC acceptance**
- [ ] Accept this RFC; amend `.claude/rules/ui-catalog.md` with the opt-in
      whole-tree-hydration carve-out; cross-link `framework/06-client-islands`.

**Phase 1 — Framework: whole-tree hydration (params-only bootstrap)**
- [ ] `hydrate` page export + `render.hydrate` config (default `"off"`).
- [ ] `client/index.ts`: add `hydratePage()` export; `patties/client` re-export.
- [ ] `build/page-entry.ts`: per-route client entry generator.
- [ ] `build/index.ts`: bundle hydrated routes, populate `manifest.byEntry`.
- [ ] `render/index.tsx`: emit `__patties_bootstrap` (params) for hydrated routes.
- [ ] Tests: a `useState` page hydrates with no mismatch; non-hydrated routes
      still ship zero JS; build-time-discovery test stays green (no runtime scan).

**Phase 2 — Framework: loader data + serialization contract**
- [ ] Optional page `loader()` whose result joins the bootstrap payload.
- [ ] Default JSON (de)serialize with per-page `serialize`/`deserialize` hook.
- [ ] Edge-target parity test; per-route client-bytes reporting in `patties build`.

**Phase 3 — `patties-shadcn` registry adapter**
- [ ] shadcn registry JSON → `ComponentEntrySchema` mapper (`@/` rewrite, peer
      deps, `cssVars` merge, `island: "off"`, transitive `registryDependencies`).
- [ ] Wire through `add` + `ui.registries`; `@shadcn` namespace default.
- [ ] Verbatim/preview/HTTPS-only/no-install guarantees reused; schema-validated.
- [ ] `patties-shadcn init` (alias + `app/lib/utils.ts` + token merge).
- [ ] Tests: `add @shadcn/dialog` stamps verbatim; deps patched not installed;
      stamped dialog opens/closes inside a hydrated example page.

**Phase 4 — Docs & DX**
- [ ] Docs page: "Using upstream shadcn/ui in patties" (hydrate opt-in, alias,
      coexistence matrix, bundle-cost note).
- [ ] `create-patties --ui shadcn` starter variant (hydrated demo route).
- [ ] `doctor` check: warn when a page mixes `<Island>` + `hydrate = true`.

## Testing strategy

- Unit: schema mapper (fixtures of real shadcn registry JSON → expected
  `ComponentEntry`); bootstrap (de)serialization round-trip.
- Integration (`bun test`): build a fixture app with one hydrated route using a
  stamped shadcn `dialog`; assert (a) SSR markup present, (b) page chunk in
  `manifest.byEntry`, (c) zero-JS routes unaffected, (d) no runtime FS scan in
  the server bundle.
- Hydration correctness: render → hydrate in a DOM env, assert no React
  mismatch warning and that an `onClick`/context interaction works.

## Risks & open questions

- **Hydration mismatch** from non-deterministic SSR (dates, random ids). Lean on
  React 19's `useId`; document determinism requirements for hydrated pages.
- **Bundle cost** is real and opt-in; need clear reporting so users choose
  knowingly (Phase 2 reporting + `doctor`).
- **shadcn registry drift**: their JSON shape evolves. Mapper must validate and
  fail loudly on unknown shapes; pin/mirror option for reproducible CI.
- **Two hydration models** on one page (islands + whole-tree) — define precedence
  (whole-tree wins; warn). 
- **`loader` data contract** (Phase 2) — is JSON-by-default + per-page hook
  enough, or do we want a typed loader API? Resolve before Phase 2.
- Naming: ship as `patties-shadcn` package, or fold entirely into
  `ui.registries` config with docs only? RFC assumes the package for discovery +
  default namespace, but the mapper is the only hard requirement.

## Acceptance criteria

- A route exporting `hydrate = true` hydrates its whole subtree with one
  `hydrateRoot`; a stamped **verbatim** upstream shadcn `Dialog` opens/closes and
  passes function props with no hydration-mismatch warning.
- Routes without `hydrate` ship zero client JS (or island-only) — unchanged.
- `patties add @shadcn/<name>` stamps upstream source verbatim, patches peer deps
  **without** running install, merges tokens, and validates against
  `ComponentEntrySchema`.
- Production server bundle performs no runtime route/island scan
  (`tests/integration/build.test.ts` stays green).
- Works on `bun` and `edge` targets.
