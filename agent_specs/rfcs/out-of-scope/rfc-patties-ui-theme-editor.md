---
rfc: patties-ui-theme-editor
title: Live theme editor / shareable preset codes
status: out-of-scope
verdict: out-of-scope
opened: 2026-05-28
reviewed: 2026-05-28
deferred_on: 2026-05-28
moved_to_oos_on: 2026-05-31
upstream_shadcn: "shadcn theme editor + `preset decode/url/open` codes"
comparable_elsewhere: "shadcn ships a live theme editor + shareable preset URLs. tweakcn (community) for shadcn themes. No framework-CLI analog — this is an app-level tool."
host_subsystem: "none — userland / app-level; CLI's theming contribution stops at stamping token sets ([[rfc-patties-ui-theming]])"
---

## Out-of-scope (2026-05-31)

**Moved deferred → out-of-scope.** Re-surveyed the shadcn ecosystem: the *visual
theme editors* with shareable codes are all community/app-level tools (tweakcn,
themecn, shadcn/studio), **not** part of shadcn-core or its CLI. shadcn-core
ships only base-color presets + `@theme inline` — which patties already encoded
([[rfc-patties-ui-theming]] → `ui/62-theming-presets`). Those tools *distribute*
themes via the **registry** mechanism, for which patties already has an analog
([[rfc-patties-ui-registries]]). So the editor is permanently app-level, and the
only CLI-shaped sliver (installing a shared theme) is already covered. If
shareable preset *codes* ever get real demand, that is a fresh, tiny
registry-adjacent RFC — not a revival of this visual-editor one. Original
deferral verdict preserved below.

## Review verdict (2026-05-28)

**Reject for v1; keep as future-work RFC.** A live visual theme editor that round-trips
shareable preset URLs is an app-level tool, not a scaffolder feature. patties'
theming contribution stops at stamping token sets the user then edits
([[rfc-patties-ui-theming]] covers base-color presets via `--theme <name>`). The
overview already scopes the theme editor as a "userland concern."

**Re-evaluation trigger:** a community asks for *shareable preset codes* across patties
projects. At that point a `patties ui theme <code>` could decode a preset into a
`tokens.css` merge — a CLI-shaped slice of the idea, without shipping a visual editor.
If no such demand appears, this moves to out-of-scope on the next refresh.

No spec changes. File preserved as `status: deferred`.

---

# RFC — live theme editor / preset codes (deferred)

## Summary
shadcn's theme editor lets users tweak colors visually and export `preset
decode/url/open` codes to share themes. This RFC records why patties does not ship it.

## Motivation
Included for parity completeness. patties stamps token sets and lets users edit
`tokens.css` directly; a visual editor is orthogonal to a Bun-native scaffolder.

## Trade-offs
- A CLI can decode a preset *code* into a token merge cheaply; the *editor* (UI to
  produce the code) is the expensive, out-of-scope part.

## Open questions
- If revisited: decode-only (`patties ui theme <code>`) vs a full local editor? The
  decode-only slice is the only part with a plausible CLI home.
