---
rfc: patties-ui-add-path
title: patties add --path — per-invocation stamp destination
status: encoded
encoded_in: ["cli/14-add-path"]
encoded_on: 2026-05-28
verdict: accept
opened: 2026-05-28
reviewed: 2026-05-28
upstream_shadcn: "shadcn `add --path <dir>`"
comparable_elsewhere: "shadcn `--path` redirects per-invocation. No Next/Remix analog (no copy-in)."
host_subsystem: "cli — packages/patties/src/cli/commands/add.ts (parseArgs + stamper)"
depends_on: [patties-ui-config-block]
---

## Review verdict (2026-05-28)

**Accept.** The only hard-coded convention shadcn users hit immediately. `--path`
overrides the component + helper destination for a single invocation, backed by
`config.ui.componentsDir` ([[rfc-patties-ui-config-block]]) for the durable case.

Scope pins:
- Affects component + `_internal/` destinations only; **`tokensFile` is unaffected**
  (one stylesheet per project).
- Resolves relative to `cwd`; rejects absolute / `..`-escaping paths (`EXIT.USAGE`).
- Precedence: `--path` > `config.ui.componentsDir` > convention default.
- Composes with `--dry-run` / `--view` / `--force` / `--all`.

Encoded into `cli/14-add-path`.

---

# RFC — `patties add --path <dir>`

## Summary
A `--path <dir>` flag that redirects where `patties add` stamps component source and
helpers, for one invocation.

## Motivation
Destination is hard-coded to `app/components/ui/`. Users with a different layout
(`src/ui`, a monorepo package) have no escape hatch. shadcn offers `--path`.

## Proposal
`parseArgs` gains `--path <value>`; the resolved dir replaces `componentsDir` in the
path set; helpers follow to `<path>/_internal/`. Missing value → `EXIT.USAGE`.

## Trade-offs
- Per-invocation only; durable redirection is `config.ui.componentsDir`. Keeping both
  avoids surprising "why did my last add land elsewhere" state.

## Open questions
- None remaining; `tokensFile` deliberately excluded from `--path`.
