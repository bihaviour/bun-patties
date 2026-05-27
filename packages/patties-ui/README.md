# patties-ui

Catalog of shadcn-parallel UI components for [Patties](../patties), shipped as **copy-in source**.

Users never import from `patties-ui` directly — the `patties add <component>` CLI in the core framework stamps source files into the user's `app/components/ui/` from the templates exported by this package.

## What lives here

- `src/registry.ts` — typed list of every component (name, phase, island flag, peer deps, file paths, status).
- `src/types.ts` — `ComponentEntry` shape.
- `templates/` — canonical source of every component, plus `_internal/{cn,slot,variants}.ts` helpers and `tokens.css`.

## Spec

See [`agent_specs/ui`](https://github.com/) in the docs repo for the per-component specs that drive what lands here.

## Status

Phase 0 — plumbing only. Real components arrive in Phase 1+.
