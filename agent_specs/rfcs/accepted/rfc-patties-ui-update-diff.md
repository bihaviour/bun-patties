---
rfc: patties-ui-update-diff
title: patties add --diff / patties update — reconcile copy-in drift
status: encoded
encoded_in: ["cli/12-add-update-diff"]
encoded_on: 2026-05-28
verdict: accept
opened: 2026-05-28
reviewed: 2026-05-28
upstream_shadcn: "shadcn `diff` / `add --diff`"
comparable_elsewhere: "shadcn `diff` shows local vs upstream registry source. Remix/Next have no copy-in catalog, so no analog. Plop/Hygen (codegen) don't track drift."
host_subsystem: "cli — packages/patties/src/cli/commands/add.ts (+ add/stamper.ts)"
---

## Review verdict (2026-05-28)

**Accept — highest-leverage parity work now the catalog is shipped.** The copy-in
model's single biggest weakness is upstream drift: users own the stamped source but
lose visibility into how the catalog moved on. This was deferred to "phase-5" in the
original cli-add spec; with all 60 components shipped, promote it.

Scope pins:
- **"Upstream" = the installed `patties-ui` version**, resolved via
  `Bun.resolveSync("patties-ui/registry", cwd)`. There is no remote registry (that's
  [[rfc-patties-ui-registries]], backlog). `bun update patties-ui` + `patties update`
  is the drift-reconciliation loop.
- **`--diff` is read-only**; `update` is the apply side (reuses the stamper with
  `force: true`, gated behind a shown diff).
- **`--check`** modifier exits non-zero on any drift, for CI staleness gates.
- Diffs cover component files **and** `_internal/` helpers + `tokens.css` fragments.

Encoded into `cli/12-add-update-diff`.

---

# RFC — `patties add --diff` / `patties update`

## Summary
Add a read-only `patties add --diff <component>` that shows a unified diff between
the user's stamped file and the catalog template, and a `patties update <component>`
that re-stamps (overwriting) after showing that diff. Reconciles the inevitable
drift in a copy-in component model.

## Motivation
Once `patties add` stamps a component the user owns it — they can edit freely. But
when `patties-ui` ships a fix or restyle, there is currently no way to see what
changed or pull it in. shadcn solves this with `diff`. Without it, the copy-in model
silently rots.

## Proposal
- `add --diff [name…]` — diff stamped files vs catalog templates; `up to date` /
  `not stamped` / unified diff per file. `--check` for CI.
- `update [name…] | --all | --dry-run` — re-stamp differing files with `force: true`,
  re-merge tokens, stamp newly-required helpers, patch new peer deps.
- Colorized on a TTY, plain when piped.

## Trade-offs
- `update` overwrites local edits — the shown diff is the safeguard; users commit
  first. A `--3way` merge is out of scope for v1.

## Open questions
- Should `--check` be a flag on `--diff` or its own `patties ui status`? (Encoded as
  a `--diff --check` modifier.)
