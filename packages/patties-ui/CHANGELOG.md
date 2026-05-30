# patties-ui

## 0.1.0

### Minor Changes

- 07ad73c: Introduce `patties-ui` as a separate, optional catalog package. Holds the registry, types, `_internal/` helpers, and `tokens.css` consumed by the `patties add` CLI. Currently `private: true` — versioned in-repo via changesets, not yet published to npm. Flip `private: false` and the standard release pipeline will publish it independently of `patties`.

## 0.0.0

Initial extraction from `patties`. Phase-0 plumbing only: registry types, `_internal/` helpers, `tokens.css`, and the `hello` test fixture. No shippable components yet. Private package — versioned in repo but not published to npm.
