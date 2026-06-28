---
spec: ui/62-theming-presets
title: Theming — base-color presets, @theme inline wiring, zero-JS dark mode
status: completed
phase: post-launch
last_reviewed: 2026-05-29
addresses: patties-ui-parity-matrix §5 (base color presets — gap; theme editor — gap; @theme inline — specced; dark mode — divergent)
rfc: patties-ui-theming, patties-ui-theme-editor
depends_on: [framework/25-ui-config-block, cli/11-ui-init]
---

# UI Spec 62 — Theming: presets, `@theme inline` wiring, zero-JS dark mode

## Purpose

This spec consolidates the theming-row parity items the matrix §5 leaves open:
CSS-variable tokens are **shipped**, `@theme inline` wiring is **specced**, dark
mode is a deliberate **divergence**, and base-color presets + a theme editor are
**gaps**. It defines the patties theming model end-to-end and the narrow preset
surface worth adding, while ratifying what stays userland.

## Shipped baseline (recorded, unchanged)

`tokens.css` ships the shadcn CSS-variable set (`--background`, `--foreground`,
`--primary`, …) and is merged idempotently by the CLI (`tokens.ts`). This spec does
not change it; it builds on it.

## `@theme inline` wiring — specced → defined

Tailwind v4 consumes the tokens via `@theme inline` in the user's `app.css`
(matrix §5 — **specced**; overview "Pillars"). patties does **not** own `app.css`;
the wiring is a snippet the user adds once. [[cli/11-ui-init]] is the surface that
*prints* (never edits) that snippet:

```css
@import "tailwindcss";
@import "./styles/tokens.css";
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* … one mapping per token … */
}
```

The token CSS is generated/merged by the CLI; the `@theme inline` mapping lives in
the user's stylesheet so they retain full control of their Tailwind entry. This
boundary is intentional and matches the build-time/userland split.

## Dark mode — divergent (zero-JS)

shadcn toggles a `.dark` class, commonly via `next-themes`. patties keeps `.dark`
on `<html>` but ships **no JS theming dependency** (matrix §5 — **divergent**;
overview cross-cutting AC). Every component is authored so dark mode is pure CSS-
variable cascade under `.dark`; nothing in the catalog imports a theme hook.

- The class can be set server-side (SSR, from a cookie/header) or by a tiny inline
  `<script>` the user owns — patties does not bundle a provider. This keeps the
  zero-JS-by-default promise and avoids a hydration-flash dependency.
- This divergence is deliberate and stays: no `next-themes`, no `useTheme` in
  stamped source.

## Base-color presets — gap → narrow design

shadcn offers base-color presets and a `baseColor`/preset system. patties has none
(matrix §5 — **gap**). The patties-native form, consistent with copy-in + no-config:

1. Ship a small set of named token presets (e.g. `neutral`, `slate`, `stone`,
   `zinc`) as alternate `tokens.css` payloads in `patties-ui/templates/themes/`.
2. `patties add --theme <name>` (or `patties ui init --theme <name>`) merges the
   chosen preset's variables instead of the default set, via the existing
   idempotent token merge. No new runtime; it only changes which CSS-variable values
   land in `tokensFile`.
3. The user owns the result — they edit `tokens.css` freely afterward. There is no
   `baseColor` config key (consistent with the convention-over-config stance — see
   the `style` / `baseColor` divergent row in `patties-ui-parity-matrix.md`); the
   preset is a one-time stamp choice, not persisted config.

This is the *only* theming-editor-adjacent feature worth building in the CLI; it is
intentionally just "pick which token values to stamp," not a live editor.

## Theme editor / preset codes — gap, scoped userland

shadcn's theme editor and `preset decode/url/open` codes are **out of scope**
(matrix §5 marks the theming editor a "userland concern"; overview agrees). A live
visual editor that round-trips preset URLs is an app-level tool, not a scaffolder
feature. patties' contribution stops at stamping token sets the user then edits.

- **Reconsider when:** a community asks for shareable preset codes across patties
  projects — at which point a `patties ui theme <code>` could decode a preset into a
  `tokens.css` merge. Tracked, not built.

## Acceptance criteria

- The `@theme inline` snippet printed by [[cli/11-ui-init]] maps the shipped tokens
  and is documented here as the canonical wiring; the CLI never edits `app.css`.
- Dark mode works by `.dark` on `<html>` with no JS dependency in any stamped
  component; no catalog file imports a theme hook or `next-themes`.
- `patties add --theme slate` (or `ui init --theme slate`) merges the `slate` preset
  token values idempotently into `tokensFile`; an unknown theme name exits
  `EXIT.USAGE`.
- No `baseColor` config key exists; preset choice is a stamp-time flag only
  (consistent with the convention-over-config stance recorded in the matrix's
  Divergent section).
- A live theme editor / preset-URL codes are explicitly out of scope with a stated
  reconsider-trigger.
