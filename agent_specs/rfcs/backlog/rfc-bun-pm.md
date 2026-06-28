---
rfc: bun-pm
title: bun pm — catalogs / workspaces for monorepos
status: backlog
verdict: defer
opened: 2026-05-27
reviewed: 2026-05-31
deferred_on: 2026-05-27
promoted_to_backlog_on: 2026-05-31
target_phase: post-launch (monorepo)
affects_specs: [cli/18-create-patties-redesign]
bun_unique: Bun-faster
host_subsystem: monorepo scaffold ([[cli/18-create-patties-redesign]]) + a future catalog-management surface
trigger_to_pickup: Spec 18's `--monorepo` scaffold + spec 27's task runner now exercise Bun workspaces/`--filter`/catalogs directly. Pick up the unencoded `bun pm` surface (pack / version / catalog *management* ergonomics in the scaffold) when the monorepo story moves from scaffold-time to lifecycle management.
comparable_elsewhere: pnpm workspaces + catalogs (pnpm 9.5+); Turborepo (build orchestration); Nx (build orchestration + generators). Next.js works inside any of these.
---

## Promoted to backlog (2026-05-31)

**Moved deferred → backlog — the named trigger fired.** The 2026-05-27 deferral
rested entirely on "no monorepo spec exists." That is now stale:
[[cli/18-create-patties-redesign]] (reviewed 2026-05-31) added a `--monorepo`
flag scaffolding a Bun workspace (`apps/*` + `packages/*`) on `bun --filter` +
catalogs, and [[framework/26-monorepo-react-resolution]] + the just-encoded
[[framework/27-task-runner-cache]] build on it. The trigger the RFC named — "the
scaffold grows a `--monorepo` flag" — has happened.

Workspaces/catalogs are now *used* by spec 18 at scaffold time, so that slice is
effectively in flight. The genuinely-unencoded backlog work is the rest of the
`bun pm` surface: `bun pm pack` / `bun pm version` and catalog *management*
ergonomics (not just the initial stamp). Parked here until the monorepo story
needs lifecycle management beyond scaffolding. Original deferral verdict below.

## Review verdict (2026-05-27)

**Reject for v1; keep as future-work RFC.** No monorepo spec
exists in patties. Templates are single-package by design (spec
05). Real demand for multi-package patties projects hasn't
materialized, and the pnpm + Turborepo combination is mature
enough that users who need it today can use those directly
without framework involvement.

Revisit when:
- The scaffold spec ([[cli/draft/09-create-patties-dx]]) grows a
  `--monorepo` flag, OR
- A real patties monorepo emerges (multiple apps in one repo,
  shared `patties.config.ts` snippets, shared design-system
  package).

**Re-evaluation trigger:** A user opening an issue asking
"how do I do a monorepo?" is the natural signal. Until then, no
hypothetical-future design.

No spec changes. File preserved as `status: deferred`.

---

# RFC — bun pm catalogs / workspaces (deferred)

## Summary

`bun pm pack` / `bun pm version` / workspace + catalog
management. Bun's built-in monorepo tooling, comparable to pnpm +
Turborepo.

## Motivation

Bun ships workspaces and catalogs as a CLI surface. A patties
monorepo story would naturally lean on these rather than pulling
in pnpm + Turborepo. Hypothetical until a real monorepo
materializes.

## Trade-offs

- **Speccing without a user means designing the wrong API.**
  Multi-app patties projects could take many shapes (multi-app
  with shared config, app + shared UI package, app + shared
  agent-platform, etc.). Without a real use case, we'd pick the
  wrong default.

## Open questions

- **Does the scaffold know about workspaces, or do users wire
  them manually?**
- **How do shared `patties/config` files get loaded across
  packages?**
- **Build orchestration** — does patties need Turborepo-style
  caching, or is `bun run --filter` enough?
