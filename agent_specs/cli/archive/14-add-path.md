---
spec: cli/14-add-path
title: patties add --path
status: completed
phase: post-launch
file: cli/commands/add.ts, cli/commands/add/ui-paths.ts
last_reviewed: 2026-05-29
addresses: patties-ui-parity-matrix §2 (--path — gap); "Gaps worth an RFC" #3
rfc: patties-ui-add-path
depends_on: [framework/25-ui-config-block]
---

# CLI Spec 14 — `patties add --path <dir>`

## Purpose

The destination for `patties add` is hard-coded to `app/components/ui/`. shadcn's
`--path` lets users redirect where component source is written; the matrix calls
this "the only hard-coded convention shadcn users will miss immediately"
(matrix §2 `--path` — **gap**; "Gaps worth an RFC" #3). This spec adds a per-
invocation `--path` flag, backed by the optional `config.ui.componentsDir`
introduced in [[framework/25-ui-config-block]].

## Usage

```
patties add --path src/ui button        # stamp button.tsx into src/ui/
patties add --path packages/web/ui --all
```

`--path` overrides the destination for **this invocation only**. For a durable
project-wide change, set `config.ui.componentsDir` instead
([[framework/25-ui-config-block]]).

## Behavior

1. `parseArgs` gains a `--path <value>` option (`add.ts:161`). It takes the next
   argv token as its value; a missing value is `EXIT.USAGE`.
2. The path is resolved relative to `ctx.cwd`. Reject absolute paths and paths that
   resolve outside the project root → `EXIT.USAGE`, one-line message. (Same guard
   as the config block.)
3. The resolved dir replaces `componentsDir` in the path set threaded through the
   stamper. `_internal/` helpers go to `<path>/_internal/` (mirrors the
   `internalDir` default). The `tokensFile` is **not** affected by `--path` — only
   component + helper destinations move; tokens stay where config/convention puts
   them (one stylesheet per project).
4. Precedence: `--path` > `config.ui.componentsDir` > convention default
   (`app/components/ui`).
5. Composes with `--dry-run`, `--view`, `--force`, `--all` — the plan/preview
   reflects the redirected destination.

## Acceptance criteria

- `patties add --path src/ui button` stamps `src/ui/button.tsx` and
  `src/ui/_internal/cn.ts`; nothing lands in `app/components/ui/`.
- `--path` with no following value exits `EXIT.USAGE`.
- An absolute `--path /etc` or a `--path ../../outside` exits `EXIT.USAGE`; no files
  written.
- `--path` overrides `config.ui.componentsDir` for that invocation only; a later
  `patties add` with no flag uses the config/convention value again.
- `patties add --path src/ui --dry-run button` shows `src/ui/button.tsx` in the
  plan.
- `tokens.css` destination is unchanged by `--path`.
