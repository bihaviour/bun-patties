# patties-ui

Optional component catalog for [Patties](../patties), shipped as **copy-in source**.

## Install

```
bun add -D patties-ui
```

Then use the `patties` CLI to stamp components into your project:

```
bunx patties add button card
bunx patties add --list
bunx patties add --all
```

Component source lands at `app/components/ui/<name>.tsx` — yours to edit. The CLI also drops shared helpers under `app/components/ui/_internal/`, merges CSS variables into `app/styles/tokens.css`, and adds the relevant peer deps to your `package.json`.

## How it works

`patties-ui` exports a typed registry (`patties-ui/registry`) and the source templates (`patties-ui/templates/...`). The `patties add` command in the `patties` CLI resolves this package from your project's `node_modules/` at command time. If `patties-ui` isn't installed, `patties add` errors with an install hint and exits — the framework itself stays lean for users on a different design system.

## Status

Phase 0 — plumbing only. Real components arrive in Phase 1+. Currently `private: true`; not yet on npm.

See [`agent_specs/ui`](https://github.com/) in the docs repo for per-component specs.
