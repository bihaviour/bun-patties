---
rfc: patties-ui-view
title: patties add --view / patties view — pre-install source preview
status: encoded
encoded_in: ["cli/13-add-view"]
encoded_on: 2026-05-28
verdict: accept
opened: 2026-05-28
reviewed: 2026-05-28
upstream_shadcn: "shadcn `view` / `add --view`"
comparable_elsewhere: "shadcn `view` previews a registry item. `npm view` shows package metadata, not stampable source."
host_subsystem: "cli — packages/patties/src/cli/commands/add.ts (+ a view command)"
---

## Review verdict (2026-05-28)

**Accept — cheap win.** `--dry-run` already shows the file/dep *plan*; `--view` adds
the actual source that would be stamped, closing the "see before you stamp" gap.
Read-only; never writes.

Scope pins:
- Strict superset of `--dry-run`'s info: metadata header + full template source per
  file, fenced by destination path.
- Syntax-styled on a TTY, plain when piped (so `patties view button > button.tsx` is
  a usable escape hatch).
- Pairs with [[rfc-patties-ui-update-diff]]: `--view` = "what will I get?", `--diff`
  = "how did mine drift?".

Encoded into `cli/13-add-view`.

---

# RFC — `patties add --view` / `patties view`

## Summary
A read-only preview that prints a component's metadata and full template source
before stamping.

## Motivation
Users currently can't inspect catalog source without stamping it (or reading the
`patties-ui` package). shadcn offers `view`.

## Proposal
`add --view <name>` (alias `patties view <name>`): reuse `resolveNames`, print the
metadata header (phase, kind, island, status, peerDeps, helpers, tokens) + each
file's source. No `package.json` / token / helper writes.

## Trade-offs
- None significant; it's a print path over data already loaded for `--dry-run`.

## Open questions
- None.
