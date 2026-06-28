---
spec: cli/17-migrate-codemods
title: patties migrate (rtl, radix)
status: completed
phase: post-launch
file: cli/commands/migrate.ts, cli/commands/ui/migrate/
last_reviewed: 2026-05-29
addresses: patties-ui-parity-matrix §1 (migrate rtl/radix — gap)
rfc: patties-ui-migrate
depends_on: [ui/22-direction]
---

# CLI Spec 17 — `patties migrate` (rtl, radix)

## Purpose

shadcn ships `migrate rtl` (rewrite physical CSS props → logical props) and
`migrate radix` (rewrite scattered `@radix-ui/react-*` imports → the unified
`radix-ui` import). patties has no codemods (matrix §1 `migrate` — **gap**). The
matrix notes the `radix` migration is *partly moot* — patties specs already target
the unified `radix-ui` style and React-19 (no `forwardRef`) — and that RTL has a
`direction` provider ([[ui/22-direction]]) but no codemod. This spec defines the
narrow, genuinely-useful slice and explicitly scopes out the moot parts.

## Why mostly moot for first-party components

Stamped `patties-ui` source already uses the unified `radix-ui` import and logical
CSS properties (per the catalog rules). So a migration over *unmodified* stamped
components is a no-op. The value is for **user-authored or pre-existing** code in
the project: components a user wrote against old shadcn conventions, or imported
from elsewhere, before adopting patties-ui.

## Usage

```
patties migrate radix [<glob>]     # @radix-ui/react-* imports → unified radix-ui
patties migrate rtl   [<glob>]     # physical CSS/Tailwind props → logical props
patties migrate <kind> --dry-run   # print the rewrite plan, change nothing
```

Default glob is the resolved `componentsDir` ([[framework/25-ui-config-block]]);
an explicit glob narrows it. Always prints a per-file before/after summary.

## Behavior — `radix`

1. Find imports matching `@radix-ui/react-<x>` and rewrite to the unified
   `import { <X> } from "radix-ui"` form (namespace import), merging multiple
   single-package imports in a file into one statement.
2. Use Bun's transpiler/AST tooling for the rewrite — no Babel/jscodeshift
   dependency (bun-native rule). If a file uses an API with no unified-import
   equivalent, leave it untouched and report it for manual review rather than
   producing broken code.
3. Idempotent: running twice changes nothing the second time.

## Behavior — `rtl`

1. Rewrite the common physical → logical mappings in both inline styles and
   Tailwind class names: `ml-*`→`ms-*`, `mr-*`→`me-*`, `pl-*`→`ps-*`, `pr-*`→`pe-*`,
   `left-*`/`right-*`→`start-*`/`end-*`, `text-left/right`→`text-start/end`, and the
   `border-l/r`, `rounded-l/r` families. CSS: `margin-left`→`margin-inline-start`,
   etc.
2. Only touch className string literals and style objects; never rewrite arbitrary
   identifiers that happen to match.
3. Pairs with the [[ui/22-direction]] provider — the codemod makes markup
   direction-agnostic; the provider sets `dir` at runtime.
4. Ambiguous cases (dynamic class construction, `clsx` with computed parts) are
   reported, not guessed.

## Safety

- `--dry-run` is the default-recommended first run; the command prints a reminder
  to commit before applying.
- Refuses to run on a dirty working tree without `--force` (so the rewrite is its
  own reviewable diff). Detected via `git status --porcelain` when in a git repo;
  outside git, `--force` is required.
- Inherits the `NODE_ENV=production` guard → `EXIT.USAGE`.

## Acceptance criteria

- `patties migrate radix` rewrites `import * as Dialog from "@radix-ui/react-dialog"`
  to the unified `radix-ui` form and is idempotent.
- A file already using unified imports is unchanged (no-op).
- `patties migrate rtl` rewrites `ml-2`→`ms-2`, `text-left`→`text-start`, etc., in
  className literals and leaves unrelated tokens alone.
- Both refuse to run on a dirty tree without `--force`; both support `--dry-run`.
- Unconvertible/ambiguous sites are reported for manual review, never silently
  mis-rewritten.
- Running over unmodified first-party stamped components is a no-op (already
  compliant).

## Implementation note (2026-05-29)

The "mostly moot for first-party" premise above is **not yet true of the shipped
catalog**: as of implementation, `patties-ui/templates/*.tsx` still use scattered
`@radix-ui/react-*` imports (≈30 files), not the unified `radix-ui` import the
catalog rule prescribes. So `patties migrate radix` over freshly-stamped
first-party components currently **does** rewrite them rather than no-op. The
codemod is correct; the catalog is the laggard. Migrating the catalog templates to
the unified import (and flipping the registry `peerDeps` from `@radix-ui/react-*`
to `radix-ui`) is tracked separately and was intentionally out of scope here.
