---
rfc: bun-cli-ansi
title: Bun.stringWidth / stripANSI / wrapAnsi — terminal output utilities
status: encoded
encoded_in: ["framework/draft/24-bun-builtin-policy"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: 1
affects_specs: [24-bun-builtin-policy, cli/07-logging-errors]
bun_unique: Bun-builtin
host_subsystem: framework/draft/24-bun-builtin-policy § 24.2 (CLI text formatting)
comparable_elsewhere: Node uses `string-width`, `strip-ansi`, `wrap-ansi` npm packages (the chalk ecosystem). Next CLI / Astro CLI / SvelteKit CLI use these via transitive deps.
---

## Review verdict (2026-05-27)

**Accept** as a policy adoption. Patties' CLI surface
(`bin/patties.ts`, `packages/create-patties`, the dev error
overlay's terminal output) will inevitably want width-aware text
math: multi-column status output, wrapped error messages, aligned
tables. The Node solution is the chalk-ecosystem trio
(`string-width`, `strip-ansi`, `wrap-ansi`) — three more deps in
every CLI install. Bun ships them in core.

Codified as section 24.2 of the **Bun-builtin policy spec**
([[framework/draft/24-bun-builtin-policy]]) rather than its own
feature spec, because the current CLI is minimal and a full
"CLI ergonomics" spec doesn't exist yet — `Bun.stringWidth` etc.
become the "reach for this when you need it" answer.

Scope pins:
- **CLI and dev-overlay only**. Not for runtime response shaping —
  user middleware that wants to colorize logs uses inline ANSI
  escapes or whatever they choose.
- **`Bun.stringWidth` for measurement**, never `String#length`,
  when emoji or CJK chars are possible.
- **`Bun.stripANSI` before piping to non-TTY** destinations (CI
  logs).
- **`Bun.wrapAnsi` for hard-wrap** that preserves inline styling.

Out of scope for this RFC:
- **`chalk` / `picocolors` adoption** — patties uses inline ANSI
  escapes for color emission, no color lib.
- **Structured-log JSON output** — separate concern; if needed,
  add a `--format=json` flag to the CLI later.

---

# RFC — Bun CLI ANSI utilities

## Summary

Three Bun helpers for terminal output:
- `Bun.stringWidth` — width-aware string length (double-width
  chars, ANSI escapes excluded).
- `Bun.stripANSI` — remove escape codes.
- `Bun.wrapAnsi` — hard-wrap text while preserving styling.

## Motivation

Pure dep replacement. The chalk-ecosystem libs (`string-width`,
`strip-ansi`, `wrap-ansi`) exist because Node has no string-width
primitive aware of emoji + CJK + ANSI escapes. Bun does.

## Proposal

See [[framework/draft/24-bun-builtin-policy|spec 24]] § 24.2 for
the policy and concrete patterns. Summary:

- CLI code (`bin/patties.ts`, `packages/create-patties`, dev
  error overlay) uses these for any width-aware text operation.
- The `cli/archive/07-logging-errors` spec is left untouched
  pending its own focused-work pass; this policy applies when
  that work happens.

## Trade-offs

- **No `chalk`-style color emission lib.** Patties emits ANSI
  escapes inline (`\x1b[36m...\x1b[0m`). Acceptable for the
  small CLI surface; a future shift to `picocolors` or similar
  would be a separate decision.

## Open questions

- **Custom log formatter or wrap an existing one (e.g. `consola`)?**
  v1: roll our own thin wrapper using these Bun primitives.
- **Structured-log JSON output** — if/when added, ANSI helpers are
  irrelevant on that path.
