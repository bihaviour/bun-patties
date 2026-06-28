---
spec: cli/12-add-update-diff
title: patties add --diff / patties update
status: completed
phase: post-launch
file: cli/commands/add.ts, cli/commands/update.ts
last_reviewed: 2026-05-29
addresses: patties-ui-parity-matrix §1 (diff — gap), §2 (--diff flag — gap); "Gaps worth an RFC" #1
rfc: patties-ui-update-diff
---

# CLI Spec 12 — `patties add --diff` / `patties update`

## Purpose

The copy-in model's single biggest weakness is **upstream drift**: once a
component is stamped into the user's repo they own it, but they lose the ability to
see how the catalog source moved on. shadcn answers this with `diff` / `add --diff`.
patties has no update/diff path (matrix §1 `diff`, §2 `--diff` — both **gap**);
the cli-add spec deferred it to "phase-5". With the full 60-component catalog now
shipped, the matrix ranks this the **highest-leverage remaining gap** ("Gaps worth
an RFC" #1). This spec promotes it.

## Usage

```
patties add --diff <component>      # show diff: stamped file ← catalog template
patties add --diff                  # diff every stamped component against the catalog
patties update <component>          # re-stamp, overwriting, after showing the diff
patties update --all                # update every stamped component
patties update --dry-run            # show what would change, write nothing
```

`--diff` is read-only. `update` is the apply side; it reuses the stamper with
`force: true` but gated behind a shown diff.

## What "upstream" means here

patties has no remote registry (see [[cli/15-registry-distribution]]); the source
of truth is the installed `patties-ui` package resolved via
`Bun.resolveSync("patties-ui/registry", cwd)` (`load-catalog.ts:20`). So "upstream"
= the template that ships with the **currently installed** `patties-ui` version.
Updating `patties-ui` (`bun update patties-ui`) then running `patties update` is
the drift-reconciliation loop, analogous to shadcn pulling newer registry source.

## Behavior — `--diff`

1. Load the catalog (`loadCatalog`). For each selected component, resolve its
   `files[]` (`from` in `templatesDir`, `to` in the resolved `componentsDir`).
2. For each file pair:
   - destination missing → report `not stamped` (skip; `--diff` never stamps).
   - identical → report `up to date`.
   - differ → print a unified diff (catalog as "incoming", local as "current"),
     using `Bun`'s text APIs; color via the existing ANSI helpers, plain when
     stdout is not a TTY.
3. Also diff `_internal/` helpers and `tokens.css` fragments the component
   declares (`internalHelpers`, `tokens`) so users see helper/token drift, not just
   the component file.
4. Exit `EXIT.OK` always (diff is informational); a `--check` modifier exits
   non-zero when any drift exists, for CI ("fail if components are stale").

## Behavior — `update`

1. Run the same diff and print it.
2. Re-stamp the differing files with `force: true` (reusing `applyStamp`), re-merge
   tokens, stamp any newly-required helpers, and patch any newly-required peer deps.
3. Files the user has locally edited are still overwritten — that is the point of
   `update`, and matches `--force` semantics. The shown diff is the safeguard;
   users commit before updating. A future `--3way` is out of scope.
4. `--dry-run` prints the plan and writes nothing (parity with `add --dry-run`,
   `add.ts:107`).

## Production guard

Both inherit the `patties add` guard: `NODE_ENV=production` → `EXIT.USAGE`
(`add.ts:34`).

## Acceptance criteria

- After `patties add button`, editing the local `button.tsx`, `patties add --diff
  button` prints a unified diff and exits `EXIT.OK`.
- `patties add --diff button` on an unmodified, current component prints `up to
  date` and produces no diff body.
- `patties add --diff` (no name) diffs all stamped components and ignores ones not
  yet stamped.
- `patties add --diff --check` exits non-zero iff at least one stamped component
  differs from the catalog — usable as a CI drift gate.
- `patties update button` overwrites `button.tsx` with catalog source and merges
  any new tokens/helpers; re-running is a no-op (`up to date`).
- `patties update --dry-run` writes nothing.
- Diffs are colorized on a TTY and plain when piped.
