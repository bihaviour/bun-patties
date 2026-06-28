---
spec: cli/15-registry-distribution
title: Registry distribution — remote/URL/namespaced installs + patties ui build
status: completed
phase: post-launch
file: cli/commands/add.ts, cli/commands/add/source.ts, cli/commands/add/registry-fetch.ts, cli/commands/ui/build.ts, patties-ui/src/schema.ts
last_reviewed: 2026-05-30
addresses: patties-ui-parity-matrix §1 (add <url>/<local-path>, build — gap), §4 (remote/namespaced registries, build — gap; package distribution — divergent); "Gaps worth an RFC" #7
rfc: patties-ui-registries
---

# CLI Spec 15 — Registry distribution: remote / URL / namespaced installs + `patties ui build`

## Purpose

shadcn resolves components from a built `registry.json` that can live at an
arbitrary URL, supports namespaced third-party registries (`@acme/...`), and is
produced by `shadcn build`. patties resolves only by **name**, from the single
local `patties-ui` registry installed in `node_modules`
(`Bun.resolveSync("patties-ui/registry", cwd)`, `load-catalog.ts:20`). The matrix
records the cluster: `add <url>`/`add <local-path>` (§1), namespaced and remote
registries (§4), and a `build` step (§1, §4) — plus the **divergence** that
`patties-ui` is `private: true` and not on npm (§4). All four were promoted from
`spec-later` to `specced` on 2026-05-29 ([[rfc-patties-ui-registries]], accepted);
they are the **lowest-priority `specced` rows** — implement after the diff/view/
path/init/theming/migrate work — but no longer gated on a third-party ecosystem
existing first.

## Divergence we keep

patties continues to refuse to run `npm/bun install` — it edits `package.json` and
tells the user to run `bun install` (`add.ts:73`). Remote installs do **not**
change that: source is fetched and stamped, deps are recorded, install stays the
user's explicit step. This Bun-native, CI-safe stance is non-negotiable (matrix §1
"Divergent-by-design").

## Source kinds for `patties add`

`add`'s positional argument is currently always a catalog name (`resolveNames`,
`add.ts:78`). This spec classifies each positional into one of:

1. **name** — `button`. Resolved from the local `patties-ui` catalog (today's path,
   unchanged default).
2. **namespaced name** — `@acme/fancy-button`. Resolved from a registry registered
   under the `@acme` namespace (see config below).
3. **local path** — `./vendor/widgets/registry.ts` or a path to a single component
   file. Loaded from disk via `Bun.file`. Useful for monorepo-internal catalogs.
4. **URL** — `https://…/registry.json` or `…/component.json`. Fetched (see
   security below).

Classification: a leading `@ns/` is namespaced; a `./`,`../`,`/` or existing path
is local; an `http(s)://` prefix is URL; otherwise a local-catalog name.

## Registry config

Namespaces map to base URLs / local paths under the `ui` config block
([[framework/25-ui-config-block]]), extended here:

```ts
ui: {
  registries: {
    "@acme": "https://registry.acme.dev/r",   // remote
    "@internal": "./packages/ui-catalog",      // local path
  },
}
```

The built-in `patties-ui` catalog is always available unprefixed; it needs no
registry entry.

## Remote fetch security

- HTTPS only; an `http://` URL is rejected unless `--allow-insecure`.
- The fetched payload must validate against the `ComponentEntry` schema
  (`patties-ui/types`); malformed JSON/TS → `EXIT.USAGE`, nothing written.
- Remote source is shown before stamping unless `--yes` (reuses the `--view`
  rendering from [[cli/13-add-view]]) — never silently execute fetched code; the
  stamped files are source the user reviews, not run at install time.
- Fetched component source is treated as untrusted text: it is written verbatim to
  the destination, never `eval`/`import`-ed by the CLI.

## `patties ui build`

shadcn's `build` compiles `registry.json` from source. patties' registry is a hand-
maintained TS module (`registry.ts`) by design (matrix §4 "hand-maintained by
design for now"). `patties ui build` is the inverse-direction tool for **registry
authors** (e.g. an `@acme` publisher): it reads a `registry.ts` + `templates/` dir
and emits a static, fetchable `registry.json` + per-component JSON payloads that
the remote-fetch path above consumes.

```
patties ui build --out dist/r            # emit dist/r/registry.json + dist/r/<name>.json
```

- Validates every entry against `ComponentEntry` and that each `files[].from`
  exists under `templates/`.
- Inlines each template's source into its component JSON so a consumer needs one
  fetch per component, no directory walking.
- Pure transform; no network, no install.

The first-party `patties-ui` stays hand-maintained TS and is **not** required to be
built — `patties ui build` exists for third-party publishers, not for the core
catalog.

## Acceptance criteria

- `patties add button` is unchanged: resolves from the local `patties-ui` catalog.
- `patties add ./vendor/widgets/card.tsx` stamps that local file into the resolved
  components dir.
- `patties add @acme/fancy-button` with `registries["@acme"]` set fetches/loads from
  that base, shows source, and stamps on confirmation; deps recorded, no install
  run.
- A non-HTTPS URL is rejected without `--allow-insecure`.
- A fetched payload that fails `ComponentEntry` validation writes nothing and exits
  `EXIT.USAGE`.
- `patties ui build --out dist/r` emits a schema-valid `registry.json` plus one JSON
  per component with inlined source; fails if a template `from` path is missing.
- No code path runs `npm/bun install`; the `bun install` reminder is printed after
  any dep change (`add.ts:73`).
