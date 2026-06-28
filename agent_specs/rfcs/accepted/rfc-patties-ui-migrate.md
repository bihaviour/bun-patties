---
rfc: patties-ui-migrate
title: patties migrate (rtl, radix) — codemods for user-authored UI code
status: encoded
encoded_in: ["cli/17-migrate-codemods"]
encoded_on: 2026-05-28
verdict: accept-scoped
opened: 2026-05-28
reviewed: 2026-05-28
upstream_shadcn: "shadcn `migrate rtl` / `migrate radix`"
comparable_elsewhere: "shadcn `migrate` codemods existing projects. jscodeshift/Babel codemods elsewhere; Bun has no codemod toolchain (we use Bun's transpiler/AST)."
host_subsystem: "cli — packages/patties/src/cli/commands/ui/migrate.ts"
depends_on: [direction-provider]
---

## Review verdict (2026-05-28)

**Accept, scoped to user-authored code.** First-party stamped components already use
the unified `radix-ui` import and logical CSS props, so a migration over unmodified
catalog source is a no-op. The value is for **user-written or imported** code adopting
patties-ui conventions.

Scope pins:
- **`radix`**: scattered `@radix-ui/react-*` imports → unified `radix-ui` namespace
  import. Uses Bun's transpiler/AST tooling — **no Babel/jscodeshift dep** (bun-native
  rule).
- **`rtl`**: physical → logical CSS/Tailwind props (`ml-*`→`ms-*`, `text-left`→
  `text-start`, etc.); pairs with the `direction` provider
  ([[ui/22-direction]]).
- Refuses to run on a dirty tree without `--force`; `--dry-run` recommended first.
- Ambiguous sites reported for manual review, never silently mis-rewritten.

Encoded into `cli/17-migrate-codemods`.

---

# RFC — `patties migrate` (rtl, radix)

## Summary
Two codemods — `radix` (unify Radix imports) and `rtl` (physical→logical CSS props) —
for migrating user-authored/imported components onto patties-ui conventions.

## Motivation
shadcn ships these codemods. patties has none. They're mostly moot for first-party
source (already compliant) but useful for code users bring from old shadcn projects.

## Proposal
`patties migrate <radix|rtl> [glob] [--dry-run] [--force]`, default glob =
`config.ui.componentsDir`. Idempotent; per-file before/after summary.

## Trade-offs
- Codemods can mis-rewrite dynamic class construction; mitigated by reporting (not
  guessing) ambiguous sites and requiring a clean tree.

## Open questions
- Is a combined `patties migrate all` worth it? (Out of scope for v1.)
