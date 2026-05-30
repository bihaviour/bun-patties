# patties-ui

Optional component catalog for [Patties](../patties), shipped as **copy-in source**.

## Install

```
bun add -D patties-ui
```

Then use the `patties` CLI to stamp components into your project:

```
bunx patties ui init                 # scaffold tokens + helpers (once)
bunx patties add button card
bunx patties add --list
bunx patties add --all
bunx patties add button --theme slate # apply a base-color preset
bunx patties view button             # print source before stamping
bunx patties update button           # re-stamp after showing the diff
bunx patties migrate                 # codemod radix imports / RTL props
```

Component source lands at `app/components/ui/<name>.tsx` — yours to edit. The CLI also drops shared helpers under `app/components/ui/_internal/`, merges CSS variables into `app/styles/tokens.css`, and adds the relevant peer deps to your `package.json`. Theme presets (`neutral` / `slate` / `stone` / `zinc`) ship under `templates/themes/`.

## How it works

`patties-ui` exports a zod-typed registry — `ComponentEntrySchema` (`patties-ui/schema`) is the source of truth, `patties-ui/registry` is the data, and `patties-ui/templates/...` holds the source. The `patties add` command in the `patties` CLI resolves this package from your project's `node_modules/` at command time. If `patties-ui` isn't installed, `patties add` errors with an install hint and exits — the framework itself stays lean for users on a different design system.

`add` also installs from local paths, https URLs, and `@ns/<name>` namespaced registries (configured via `ui.registries` in `patties.config.ts`); `patties ui build` emits a fetchable `registry.json` + per-component payloads so third parties can publish their own registries.

## Status

All 60 components shipped and published to npm. `patties add <component>` stamps source into your project.

See [`agent_specs/ui`](https://github.com/) in the docs repo for per-component specs.
