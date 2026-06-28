---
spec: cli/13-add-view
title: patties add --view / patties view
status: completed
phase: post-launch
file: cli/commands/add.ts, cli/commands/view.ts, cli/commands/ui/view.ts
last_reviewed: 2026-05-29
addresses: patties-ui-parity-matrix §1 (view — gap), §2 (--view flag — gap); "Gaps worth an RFC" #4
rfc: patties-ui-view
---

# CLI Spec 13 — `patties add --view` / `patties view`

## Purpose

shadcn lets you preview a registry item's source before installing (`view` /
`add --view`). patties has no pre-install preview — `--dry-run` shows the *file and
dep plan* but not the *source* (matrix §1 `view`, §2 `--view` — **gap**). The
matrix rates this cheap to add on top of `--dry-run` and a clean win for the
"see before you stamp" gap ("Gaps worth an RFC" #4).

## Usage

```
patties add --view <component>       # print the component's source + metadata
patties view <component>             # alias of the above
patties add --view --dry-run <c>     # --view implies read-only; --dry-run is redundant but allowed
```

`--view` never writes. It is a strict superset of `--dry-run`'s information: the
plan **plus** the actual source that would be stamped.

## Behavior

1. Load the catalog and resolve the named component (reuse `resolveNames`,
   `add.ts:78`). Unknown name → `EXIT.USAGE`, same message as `add`.
2. Print a metadata header: name, phase, `kind`, `island`, `status`, declared
   `peerDeps`, `internalHelpers`, `tokens` — the same fields `--dry-run` surfaces
   (`add.ts:100`,`118`).
3. For each file in `entry.files`, read the template from `templatesDir` and print
   its full source, fenced with the destination path as a heading so the user sees
   exactly what lands where.
4. With a TTY, apply lightweight syntax styling via the ANSI helpers; when piped,
   emit plain text so `patties view button > button.tsx` is a usable escape hatch.
5. `--view` is read-only; never patches `package.json`, never merges tokens.

## Relationship to `--dry-run` and `--diff`

- `--dry-run` (shipped, `add.ts:107`): plan only — which files are new/exist, dep
  diff, token/helper plan. No source.
- `--view` (this spec): plan + **source of the catalog template**.
- `--diff` ([[cli/12-add-update-diff]]): catalog source **vs the user's stamped
  file** — only meaningful once stamped.

`--view` answers "what will I get?"; `--diff` answers "how did mine drift?".

## Acceptance criteria

- `patties add --view button` prints the metadata header and the full source of
  every file in the button entry, writes nothing, exits `EXIT.OK`.
- `patties view button` behaves identically (alias).
- `patties add --view nonexistent` exits `EXIT.USAGE` with the unknown-component
  message.
- Output is syntax-styled on a TTY and plain when piped; piping a single-file
  component yields valid `.tsx` source.
- No `package.json`, `tokens.css`, or `_internal/` writes occur during `--view`.
