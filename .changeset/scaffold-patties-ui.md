---
"patties-ui": minor
---

Introduce `patties-ui` as a separate, optional catalog package. Holds the registry, types, `_internal/` helpers, and `tokens.css` consumed by the `patties add` CLI. Currently `private: true` — versioned in-repo via changesets, not yet published to npm. Flip `private: false` and the standard release pipeline will publish it independently of `patties`.
