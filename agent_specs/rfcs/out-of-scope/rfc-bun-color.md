---
rfc: bun-color
title: Bun.color — color parsing / conversion utility
status: out-of-scope
verdict: out-of-scope
opened: 2026-05-27
reviewed: 2026-05-27
deferred_on: 2026-05-27
moved_to_oos_on: 2026-05-31
target_phase: never
affects_specs: []
bun_unique: Bun-builtin
host_subsystem: none — no spec slot; would only matter inside a design-tokens / styling plugin that doesn't exist
comparable_elsewhere: Not standard in Next/Remix. Tools that own this niche: Tailwind (color utilities), `culori`, `chroma-js`, Vanilla Extract, Radix Colors.
---

## Out-of-scope (2026-05-31)

**Moved deferred → out-of-scope.** Re-checked against the now-shipped Patties UI
catalog: theming ([[rfc-patties-ui-theming]] → `ui/62-theming-presets`) ships
**pre-authored `tokens.css` payloads** merged at stamp time — the CLI never
parses, converts, or generates color values, and persists no `baseColor` key. So
patties-ui is *not* a `Bun.color` consumer. The only triggers the deferral named
(a first-party design-token system, or a built-in component generating
gradients/palettes) would each reverse the "framework, not design system" stance
— a permanent no, not a wait-and-see. Kept as a discovered-and-dismissed record.
Original deferral verdict preserved below.

## Review verdict (2026-05-27)

**Reject for v1; keep as future-work RFC.** Patties is a
meta-framework, not a design system. Styling is delegated to the
user — Tailwind, CSS Modules, Vanilla Extract, whatever they
choose. There is no framework slot for color utilities and the
current project stance is "framework, not design system."

Revisit when:
- A first-party `patties/style` or design-token system enters the
  roadmap (currently not planned), OR
- A built-in component (e.g. `<Image>` with placeholder gradient
  generation) needs color parsing internally.

**Re-evaluation trigger:** This RFC is borderline-out-of-scope —
if no design-tokens / styling surface ever opens, it likely moves
to out-of-scope on next refresh.

No spec changes. File preserved as `status: deferred`.

---

# RFC — Bun.color (deferred)

## Summary

`Bun.color` parses / converts color strings (hex, RGB, HSL,
OKLCH) without a userland lib.

## Motivation

Useful in design-token / styling-helper contexts. Patties has
none of those today.

## Trade-offs

- **Adopting would commit to a styling opinion.** Patties'
  current stance is "framework, not design system."

## Open questions

- **Does the framework actually want to ship design opinions?**
  Current stance: no. Revisit if this changes.
- **If yes, what's the API contract** — runtime helper,
  build-time token generation, or both?
