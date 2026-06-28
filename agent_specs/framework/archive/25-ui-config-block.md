---
spec: framework/25-ui-config-block
title: patties.config.ts — optional `ui` block
status: completed
phase: conventions
file: src/config/, packages/patties/src/cli/commands/add/
last_reviewed: 2026-05-29
addresses: patties-ui-parity-matrix §3 (config-model gap), §2 (--path flag gap)
rfc: patties-ui-config-block
depends_on: [cli/14-add-path]
---

# Spec 25 — optional `ui` block in `patties.config.ts`

## Purpose

shadcn centralizes UI scaffolding config in `components.json`. patties replaces
that with **fixed conventions** (`app/components/ui/`, `_internal/`,
`app/styles/tokens.css`, CSS-vars always on, `lucide-react`, no RSC toggle). The
parity matrix records that stance as a deliberate **divergence** — less surface,
no config drift — but flags one real cost: shadcn's `--path` flexibility, the one
hard-coded convention users miss immediately (matrix §3 "Takeaway", §2 `--path`).

This spec adds a *narrow, optional* `ui` block to `patties.config.ts` so that the
two paths that genuinely vary between projects — where component source is stamped
and where tokens live — can be redirected, without reintroducing a full
`components.json`. Everything not listed here stays convention, not config.

## Non-goals (kept as convention, not config)

These remain fixed; we are not porting `components.json` wholesale:

- **`aliases`** — import paths are derived from `componentsDir`, not separately
  configurable. (matrix §3: divergent)
- **`cssVariables` on/off, `style`, `baseColor`, `rsc`, `tsx`** — patties is
  always CSS-vars-on, single-style, SSR-island, `.tsx`. (matrix §3: divergent)
- **`iconLibrary`** — `lucide-react` is fixed; userland swaps icons by editing
  stamped source. (matrix §3: n/a)

If a future RFC wants any of these configurable, it extends this block — but the
default of "no config needed" must survive.

## Schema

The `ui` block is fully optional. Absent config behaves exactly as today.

```ts
// src/config/schema.ts (Zod)
const UiConfig = z
  .object({
    // Where `patties add` stamps component source. Default: "app/components/ui".
    componentsDir: z.string().default("app/components/ui"),
    // Where shared helpers (_internal/cn, slot, variants) are stamped.
    // Default: "<componentsDir>/_internal".
    internalDir: z.string().optional(),
    // Where the token CSS is merged. Default: "app/styles/tokens.css".
    tokensFile: z.string().default("app/styles/tokens.css"),
  })
  .strict()
  .optional();
```

- All paths are resolved relative to the project root (the dir holding
  `patties.config.ts`), never absolute, never `..`-escaping the project — the
  loader rejects paths that resolve outside the project root (`EXIT.USAGE`).
- `internalDir` defaults to `<componentsDir>/_internal` so redirecting
  `componentsDir` keeps helpers co-located without a second setting.

## Resolution & precedence

`patties add` resolves effective paths in this order (first wins):

1. `--path <dir>` CLI flag (per [[cli/14-add-path]]) — affects `componentsDir`
   only, for one invocation.
2. `config.ui.componentsDir` / `internalDir` / `tokensFile`.
3. The hard-coded convention defaults above.

The add pipeline (`stamper.ts`, `internal.ts`, `tokens.ts`) currently hard-codes
these destinations; this spec threads a resolved `UiPaths` object through them
instead of string literals.

## Manifest / agent-md

No manifest change. The `ui` block is read by the CLI add pipeline only; it is not
part of route/island discovery and does not appear in the generated `CLAUDE.md`
manifest section.

## Acceptance criteria

- With no `ui` block, `patties add button` stamps to `app/components/ui/button.tsx`
  and `app/components/ui/_internal/cn.ts`, tokens to `app/styles/tokens.css` —
  byte-identical to today.
- With `ui: { componentsDir: "src/ui" }`, `patties add button` stamps to
  `src/ui/button.tsx` and helpers to `src/ui/_internal/`.
- With `ui: { tokensFile: "styles/theme.css" }`, the token merge targets that file
  and is idempotent on re-run.
- A `componentsDir` that resolves outside the project root exits `EXIT.USAGE` with
  a one-line message; no files are written.
- `config.ui` is `.strict()` — an unknown key (e.g. `aliases`) is a config error,
  pointing the user at the convention it replaces.
- `bun run typecheck` passes; the config Zod schema infers the optional `ui` shape.
