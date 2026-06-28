---
rfc: patties-ui-init
title: patties ui init — front-load theming + helper setup
status: encoded
encoded_in: ["cli/11-ui-init"]
encoded_on: 2026-05-28
verdict: accept
opened: 2026-05-28
reviewed: 2026-05-28
upstream_shadcn: "shadcn `init`"
comparable_elsewhere: "shadcn `init` writes components.json + CSS vars + deps. Next/Remix have no UI-init. Tailwind `init` writes a config file."
host_subsystem: "cli — packages/patties/src/cli/commands/ui/init.ts; reuses add/ tokens + internal stampers"
depends_on: [patties-ui-config-block]
---

## Review verdict (2026-05-28)

**Accept — as an optional convenience, not a prerequisite.** Today `tokens.css` +
`_internal/` are created lazily on the first `patties add`, so the first stamp
silently also does theme + helper setup. `patties ui init` front-loads that on its
own reviewable commit, and lets a project adopt the token model before picking
components.

Scope pins:
- **`add` stays self-bootstrapping** — running `add` without ever running `init`
  works exactly as today. `init` is optional.
- No interactive prompts (CLI pillar "one command, zero questions"); no
  style/baseColor/rsc questions — those are conventions, not config.
- **Never edits `app.css`** — prints the `@theme inline` wiring snippet only
  (overlaps with [[rfc-patties-ui-theming]]).
- Never runs `bun install`; patches `package.json` + prints the reminder.

Encoded into `cli/11-ui-init`.

---

# RFC — `patties ui init`

## Summary
A one-time, idempotent setup command that lays down `tokens.css`, `_internal/cn.ts`
(+ `clsx`/`tailwind-merge`), and prints the Tailwind `@theme inline` wiring snippet.

## Motivation
The first `patties add` does double duty (component + theme/helper bootstrap). Surfacing
the bootstrap as its own step makes it explicit, reviewable, and adoptable before any
component is stamped.

## Proposal
`patties ui init [--dry-run] [--force]`: merge tokens idempotently, stamp `cn` (not
slot/variants — those arrive with the first component that needs them), patch base
deps, report the `app.css` wiring snippet. Honors `config.ui` overrides.

## Trade-offs
- Adds a command users may skip; mitigated by keeping `add` self-bootstrapping so
  `init` is never required.

## Open questions
- Should `init` accept `--theme <name>` to seed a base-color preset? (Yes — defined in
  [[rfc-patties-ui-theming]].)
