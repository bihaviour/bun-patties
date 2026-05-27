---
"patties": patch
---

Internal: move framework source from the repo root into
`packages/patties/` so the framework participates in changesets-managed
releases. The repo root is now a private workspace shell; both
`patties` and `create-patties` live under `packages/*` and are
discovered uniformly by changesets and `bun --filter`.

No public API changes. The published tarball still ships `src/`,
`bin/`, `AGENTS.md`, `README.md`, and `CHANGELOG.md` at the same
relative paths inside the package.
