---
spec: cli/11-ui-init
title: patties ui init
status: completed
phase: post-launch
file: cli/commands/ui/init.ts
last_reviewed: 2026-05-29
addresses: patties-ui-parity-matrix §1 (init — gap)
rfc: patties-ui-init
depends_on: [framework/25-ui-config-block]
---

# CLI Spec 11 — `patties ui init`

## Purpose

shadcn's `init` bootstraps `components.json`, installs base deps, writes CSS
vars, and sets up aliases — so the first `add` is purely a component copy. patties
has no UI-init step: `tokens.css` and `_internal/` are created lazily on the first
`patties add` (matrix §1, `init` — **gap**). That works, but it means a user's
first `add` silently also does theme + helper + Tailwind setup, and there is no
way to lay down theming *before* picking components.

`patties ui init` front-loads that one-time setup so it is explicit and reviewable
on its own commit, and so a project can adopt the token model without stamping any
component yet.

## Usage

```
patties ui init                 # idempotent: lay down tokens + helpers + Tailwind wiring
patties ui init --dry-run       # print the plan, write nothing
patties ui init --force         # overwrite existing tokens.css / _internal helpers
```

No interactive prompts (CLI pillar "one command, zero questions"). There is no
style/baseColor/rsc question to ask — those are conventions, not config (see
[[framework/25-ui-config-block]]).

## Behavior

Resolves destinations via the same precedence as `patties add` — `config.ui`
overrides, else convention defaults ([[framework/25-ui-config-block]]). Then,
idempotently:

1. **Tokens.** Merge `patties-ui/templates/tokens.css` into the resolved
   `tokensFile` (`app/styles/tokens.css` by default) using the existing idempotent
   merge (`tokens.ts`). Re-running adds only missing variables.
2. **Helpers.** Stamp `_internal/cn.ts` (+ `clsx`, `tailwind-merge`) into the
   resolved `internalDir`. Slot/variants helpers are NOT pre-stamped — they arrive
   with the first component that needs them, to avoid dead files.
3. **Peer deps.** Patch `package.json` with the base helper deps (`clsx`,
   `tailwind-merge`). Never runs `bun install` — prints the `bun install` reminder,
   matching `patties add`'s CI-safe stance (`add.ts:73`).
4. **Tailwind wiring check.** If `app.css` (or the project's main stylesheet) does
   not already `@import` the tokens file and declare `@theme inline`, print a copy-
   pasteable snippet. Do **not** edit the user's `app.css` automatically — the
   overview scopes `@theme inline` wiring as living in the user's stylesheet
   (overview "Pillars"; matrix §5 marks it **specced**). `init` only reports.

Existing files are skipped (not overwritten) unless `--force`, identical to the
stamper's default never-overwrite behavior.

## Production guard

Inherits `patties add`'s guard: refuses to run with `NODE_ENV=production`
(`add.ts:34`), exit `EXIT.USAGE`.

## Relationship to `patties add`

`patties add <component>` remains fully self-bootstrapping — running `add` without
ever running `init` works exactly as today (lazy creation). `init` is an optional
convenience, not a prerequisite. Running `add` after `init` finds tokens + `cn`
already present and skips them.

## Output example

```
$ patties ui init
✓ tokens     app/styles/tokens.css (created)
✓ helper     app/components/ui/_internal/cn.ts (created)
  deps       + clsx@^2  + tailwind-merge@^3
  tailwind   add to app.css:
               @import "./styles/tokens.css";
               @theme inline { /* … */ }
done. Run `bun install` to fetch the new peer dependencies.
```

## Acceptance criteria

- In a fresh project, `patties ui init` creates `tokens.css` + `_internal/cn.ts`
  and patches `package.json`; no `bun install` is run.
- Re-running `patties ui init` is a no-op (all "exists", exit `EXIT.OK`); `--force`
  re-stamps.
- `patties add button` immediately after `init` skips tokens/`cn` (already present)
  and only stamps `button.tsx`.
- `patties ui init` never edits `app.css`; it prints the wiring snippet only.
- Honors `config.ui.componentsDir` / `tokensFile` overrides.
- In `NODE_ENV=production`, exits `EXIT.USAGE` with the dev-only message.
