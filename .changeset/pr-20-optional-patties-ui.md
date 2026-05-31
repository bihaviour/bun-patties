---
"patties": patch
---

Make `patties-ui` truly optional at the CLI: the `add` / `ui` / `view` /
`update` catalog commands (the only modules that import `patties-ui`) are now
lazy-loaded in the command dispatcher, so `patties dev` / `build` / `deploy` /
`secret` no longer fail with "Cannot find module 'patties-ui/schema'" in
projects that don't depend on the UI catalog (e.g. backend or `--no-ui`
projects scaffolded by create-patties).
