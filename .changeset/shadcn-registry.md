---
"patties": minor
"patties-ui": minor
---

`patties add @shadcn/<name>` stamps upstream shadcn/ui verbatim: registry items are mapped onto the existing add pipeline (import alias rewrite, transitive registry deps, pinned peer deps, `cssVars` token merge, schema validation, HTTPS-only, never installs). `patties ui init --shadcn` wires the `@/*` alias and `app/lib/utils.ts`. `patties-ui`'s `ComponentFileSchema` gains an optional `root` (`components` | `app`) for files stamped into `app/{components,hooks,lib}`; the stamper refuses any other app-dir destination.
