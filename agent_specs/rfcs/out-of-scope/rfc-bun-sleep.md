---
rfc: bun-sleep
title: Bun.sleep / Bun.sleepSync — delay helpers
status: out-of-scope
verdict: out-of-scope
opened: 2026-05-27
reviewed: 2026-05-27
deferred_on: 2026-05-27
moved_to_oos_on: 2026-05-31
target_phase: never
affects_specs: []
bun_unique: Bun-builtin
host_subsystem: none — trivial utility, no spec slot
comparable_elsewhere: `node:timers/promises.setTimeout(ms)` on Node; `new Promise(r => setTimeout(r, ms))` everywhere. Frameworks don't typically expose this.
---

## Out-of-scope (2026-05-31)

**Moved deferred → out-of-scope.** There is no realistic future in which
patties owns a named sleep helper: `new Promise(r => setTimeout(r, ms))` is the
universal one-liner and `node:timers/promises` covers the rest. The only trigger
the deferral named (a first-party `test-helpers`/`dev-utils` surface) does not
justify wrapping `setTimeout`. Kept as a discovered-and-dismissed record so the
audit doesn't re-surface it. Original deferral verdict preserved below.

## Review verdict (2026-05-27)

**Reject for v1; keep as future-work RFC.** This is trivial
userland — `new Promise(r => setTimeout(r, ms))` is one line,
`Bun.sleep(ms)` saves three characters. No framework slot needs
this, and reaching for it would just add a Bun-coupling where
none is necessary.

Revisit when:
- A first-party `patties/test-helpers` or `patties/dev-utils`
  surface is being designed that wants named primitives, OR
- A test fixture pattern emerges where `Bun.sleep` is
  meaningfully clearer than the inline alternative.

**Re-evaluation trigger:** This RFC is borderline-out-of-scope —
if no test/dev-helpers surface ever opens, it likely moves to
out-of-scope on next refresh rather than being revisited.

No spec changes. File preserved as `status: deferred`.

---

# RFC — Bun.sleep (deferred)

## Summary

`Bun.sleep(ms)` returns a promise that resolves after `ms`.
`Bun.sleepSync(ms)` blocks. Convenience helpers around
`setTimeout`.

## Motivation

Trivial userland; included for completeness in the audit. The
framework has no slot for a named sleep helper today.

## Trade-offs

- **Bun-coupling for trivial gain.** Adopting in framework code
  ties patties slightly closer to Bun without meaningful
  capability gain — the inline `setTimeout`-promise wrapper
  works everywhere.

## Open questions

- **`sleepSync` rarely makes sense in async-first code** — would
  we ever ship it?
