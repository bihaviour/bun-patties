---
rfc: patties-ui-registries
title: Remote / URL / namespaced registries + patties ui build
status: encoded
encoded_in: ["cli/15-registry-distribution"]
encoded_on: 2026-05-29
verdict: accept
opened: 2026-05-28
reviewed: 2026-05-29
upstream_shadcn: "shadcn `add <url>` / `add <local-path>`, namespaced `@acme/...` registries, `shadcn build`"
comparable_elsewhere: "shadcn resolves from registry URLs + namespaces and builds registry.json. npm scopes (`@scope/pkg`) for distribution. Next/Remix have no component registry."
host_subsystem: "cli — add source-kind classification + a `patties ui build`; backed by ui.registries config"
depends_on: [patties-ui-config-block]
---

## Review verdict (2026-05-29)

**Accept — promoted from backlog.** Previously parked as the lowest-priority parity
item, now brought onto the implementation path alongside the other `specced` rows.
The full design was already on record in `cli/15-registry-distribution`; this promotion
flips its status from "design of record, build on demand" to "scheduled work."

Scope pins (unchanged from the on-record spec):
- **Source kinds**: name | namespaced (`@ns/name`) | local path | URL.
- **`ui.registries`** namespace→base map, extending the `ui` config block
  ([[rfc-patties-ui-config-block]]).
- **HTTPS-only** fetch, `ComponentEntry`-schema validated, source shown before stamp;
  fetched source written as text, **never** `eval`/`import`-ed.
- **Never runs `npm/bun install`** — preserves the CI-safe divergence (`add.ts:73`).
- **`patties ui build`** is for third-party catalog authors; first-party `patties-ui`
  stays hand-maintained TS and is not required to be built.

Lowest priority among the `specced` rows (see the matrix Implementation order), but no
longer gated behind a "third-party ecosystem exists" trigger.

Encoded into `cli/15-registry-distribution`.

---

# RFC — remote / URL / namespaced registries + `patties ui build`

## Summary
Extend `patties add` to resolve components from URLs, local paths, and namespaced
third-party registries (`@acme/fancy-button`), and add `patties ui build` to compile a
`registry.ts` + `templates/` into a fetchable `registry.json` for third-party authors.

Full design is on record in `cli/draft/15-registry-distribution`.

## Motivation
patties resolves only by name, from the single first-party `patties-ui` registry in
`node_modules` (`load-catalog.ts:20`). To support company-internal catalogs and a
community ecosystem, `add` needs to resolve from URLs / local paths / namespaces, and
catalog authors need a `build` step to emit a fetchable artifact.

## Design highlights (from cli/15)
- Source kinds: name | namespaced (`@ns/name`) | local path | URL.
- `ui.registries` namespace→base map ([[rfc-patties-ui-config-block]]).
- HTTPS-only fetch, `ComponentEntry`-schema validated, source shown before stamp;
  fetched source is written as text, never `eval`/`import`-ed.
- **Never runs `npm/bun install`** — preserves the CI-safe divergence (`add.ts:73`).
- `patties ui build --out dist/r` emits schema-valid `registry.json` + per-component
  JSON with inlined source. First-party `patties-ui` stays hand-maintained TS and is
  not required to be built.

## Open questions
- Integrity: do remote registries need a lockfile/hash pin to detect tampering?
- Caching: cache fetched registries under a project-local dir, or always re-fetch?
