---
rfc: bun-package-hygiene
title: bun patch / audit / outdated — project hygiene CLI
status: encoded
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-31
deferred_on: 2026-05-27
encoded_in: ["cli/20-doctor"]
encoded_on: 2026-05-31
target_phase: 0.1.x (pre-publish)
affects_specs: [cli/10-scaffold-probes, framework/24-bun-builtin-policy]
bun_unique: Bun-builtin
host_subsystem: cli/20-doctor (the `patties doctor` surface this RFC was waiting for)
comparable_elsewhere: `npm audit` / `npm outdated`; `patch-package` (community lib). Standard hygiene tooling exists in every package manager.
---

## Encoded (2026-05-31)

**Accept — encoded as [[cli/20-doctor]].** Pulled forward from post-1.0 to the
**0.1.x pre-publish** window: shipping a package with no project-hygiene story is
poor practice for a published framework, and the integrated `patties doctor` UX
the original verdict was waiting for is exactly what spec 20 defines. The cluster
lands together as that verdict required — spec 20 reuses the `Bun.which` probe
helper from [[rfc-bun-which]] (extending the scaffold's 2-probe set to a
lifecycle set) and the width-aware output utilities from [[rfc-bun-cli-ansi]]
(spec 24 §24.2). Resolved open questions are pinned in spec 20: severity *is*
surfaced (with an `--audit-level` gate), and Phase 1 stays **report-only** —
inheriting bun-which's "never install/modify on the user's behalf" rule; `--fix`
and scheduled audits ([[rfc-bun-cron]]) are Phase 2. Original deferral verdict
preserved below.

## Review verdict (2026-05-27)

**Reject for v1; keep as future-work RFC.** There is no
dedicated CLI surface for project hygiene yet. The scaffold spec
ends at "init"; nothing covers "keep this project healthy over
time." Users today reach for `bun audit` / `bun outdated`
directly — patties doesn't need to wrap these without a clear
value-add.

Revisit when:
- A `patties doctor` or `patties upgrade` command is being
  drafted (this is also the trigger for [[rfc-bun-which]]'s
  extended scope and [[rfc-bun-cli-ansi]]'s richer probe output),
  OR
- A scheduled hygiene story emerges (e.g. nightly dependency
  audits via [[rfc-bun-cron]]).

**Re-evaluation trigger:** The cluster of "doctor" RFCs (which,
this one, possibly cli-ansi extensions) revisits together when a
doctor spec opens. Don't accept this one in isolation — the
value is the integrated `patties doctor` UX, not the wrapper
around `bun audit`.

No spec changes. File preserved as `status: deferred`.

---

# RFC — bun patch / audit / outdated (deferred)

## Summary

Bun's built-in package management hygiene commands. Patties could
wrap them in a `patties doctor` / `patties upgrade` flow.

## Motivation

Hygiene tooling is standard in every package manager. Patties
could thread these into a single `patties doctor` UX. Without
that UX, wrapping individual commands adds nothing over calling
`bun audit` directly.

## Trade-offs

- **Wrapping for the sake of wrapping is friction.** The pattern
  only pays off when `patties doctor` aggregates multiple checks
  into one command — security advisories, outdated deps,
  lockfile health, biome config validity, etc.

## Open questions

- **What does `patties doctor` actually check** vs delegate to
  `bun audit`?
- **Should we surface security-advisory severity** to the user,
  or pass through Bun's output verbatim?
- **How does this interact with the scaffold's
  [[rfc-bun-which]] probes?** Both want the doctor surface;
  one acceptance pass should land them together.
