---
rfc: patties-ui-config-block
title: Optional `ui` block in patties.config.ts — redirectable stamp paths
status: encoded
encoded_in: ["framework/25-ui-config-block"]
encoded_on: 2026-05-28
verdict: accept
opened: 2026-05-28
reviewed: 2026-05-28
upstream_shadcn: "shadcn `components.json` (aliases / tailwind.css paths)"
comparable_elsewhere: "shadcn centralizes paths in components.json. Next/Remix have no component-stamp config. tsconfig `paths` is the closest path-alias analog."
host_subsystem: "framework — src/config/ (defineConfig + Zod schema); consumed by cli add pipeline"
---

## Review verdict (2026-05-28)

**Accept — narrowly.** patties' "config = convention" stance is a legitimate
divergence (less surface, no config drift), but it costs the one thing shadcn users
miss immediately: redirectable stamp paths. Add a *minimal* optional `ui` block — only
the paths that genuinely vary per project — without reintroducing `components.json`.

Scope pins:
- Exposes **only** `componentsDir`, `internalDir`, `tokensFile`, and (for
  [[rfc-patties-ui-registries]]) `registries`. Everything else stays convention.
- `.strict()` — an unknown key (e.g. `aliases`, `style`, `rsc`) is a config error
  pointing at the convention it replaces.
- Paths resolve relative to project root; reject absolute / `..`-escaping paths.
- Backs the `--path` flag ([[rfc-patties-ui-add-path]]) and `patties ui init`
  ([[rfc-patties-ui-init]]).

Encoded into `framework/25-ui-config-block`.

---

# RFC — optional `ui` block in `patties.config.ts`

## Summary
A fully-optional `ui` block on the patties config so projects can redirect *where*
component source, helpers, and tokens are stamped. Absent config behaves exactly as
today.

## Motivation
`patties add` hard-codes `app/components/ui/`, `_internal/`, and
`app/styles/tokens.css`. Monorepos and non-`app/` layouts can't redirect. shadcn's
`components.json` makes this configurable; patties needs the same flexibility for the
two paths that actually vary, without the rest of the config surface.

## Proposal
```ts
ui: {
  componentsDir: "app/components/ui",      // default
  internalDir: undefined,                  // default: <componentsDir>/_internal
  tokensFile: "app/styles/tokens.css",     // default
}
```
Thread a resolved `UiPaths` through `stamper.ts` / `internal.ts` / `tokens.ts`
instead of string literals. Precedence: `--path` flag > `config.ui` > convention.

## Trade-offs
- Any config is config drift risk; mitigated by keeping the surface to three paths
  and `.strict()`-rejecting everything else.

## Open questions
- Should `registries` live here or in a separate `ui.registries`? (Encoded here,
  extended by the registries RFC.)
