---
rfc: patties-ui-theming
title: Theming — @theme inline wiring + base-color token presets
status: encoded
encoded_in: ["ui/62-theming-presets"]
encoded_on: 2026-05-28
verdict: accept
opened: 2026-05-28
reviewed: 2026-05-28
upstream_shadcn: "shadcn `baseColor` presets + `@theme inline` token wiring"
comparable_elsewhere: "shadcn ships base-color presets + a theme editor. Tailwind v4 `@theme inline` is the upstream-shared mechanism. next-themes for dark mode (patties avoids it)."
host_subsystem: "ui catalog (templates/themes/*) + cli add/init token merge"
---

## Review verdict (2026-05-28)

**Accept the two buildable theming slices; the live editor is split out as deferred
([[rfc-patties-ui-theme-editor]]).**

Scope pins:
- **`@theme inline` wiring** is the canonical Tailwind v4 mechanism (matrix had it
  "specced"). patties does **not** own `app.css`; the wiring is a snippet the CLI
  *prints* (via `patties ui init`), never auto-edits.
- **Base-color presets** ship as alternate `tokens.css` payloads under
  `patties-ui/templates/themes/` (e.g. `neutral`/`slate`/`stone`/`zinc`), selected at
  stamp time via `--theme <name>` (on `add` or `ui init`). **No persisted `baseColor`
  config key** — the preset is a one-time stamp choice the user then edits (consistent
  with the convention-over-config stance).
- **Dark mode stays divergent**: `.dark` on `<html>`, zero JS theming dep, no
  `next-themes` — recorded, not changed here.

Encoded into `ui/62-theming-presets`.

---

# RFC — theming: `@theme inline` wiring + base-color presets

## Summary
Define the canonical Tailwind v4 `@theme inline` wiring snippet patties prints, and add
stamp-time base-color token presets via `--theme <name>`.

## Motivation
shadcn offers a base-color/preset system and documents `@theme inline`. patties shipped
the default token set but had no preset choice and no canonical wiring doc.

## Proposal
- Ship `templates/themes/<name>/tokens.css` preset payloads; `--theme <name>` merges
  the chosen values via the existing idempotent token merge (`tokens.ts`).
- `patties ui init` prints the `@theme inline` mapping for the shipped tokens.

## Trade-offs
- A preset is stamp-time only (not reconfigurable later) — but the user owns
  `tokens.css` and edits freely, so this matches copy-in.

## Open questions
- Shareable preset *codes/URLs* across projects → split to
  [[rfc-patties-ui-theme-editor]] (deferred).
