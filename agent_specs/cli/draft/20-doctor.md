---
spec: cli/20-doctor
title: patties doctor — project hygiene checks
status: draft
phase: 0.1.x
file: src/cli/doctor.ts
last_reviewed: 2026-05-31
rfc: rfc-bun-package-hygiene
---

# CLI Spec 20 — `patties doctor`

## Purpose

Give a patties project a single "is this project healthy?" command. The scaffold
story ends at init ([[cli/10-scaffold-probes]]); nothing covers keeping a project
healthy **over its lifetime** — outdated deps, security advisories, lockfile
drift, an invalid config. Before publishing 0.1.x, a published framework should
ship that story rather than leave users to remember a grab-bag of `bun`
sub-commands.

`patties doctor` aggregates a set of read-only checks into one report. It does
not reinvent Bun's hygiene commands — it **runs and contextualizes** them
(`bun audit`, `bun outdated`), adds patties-specific checks (config validity,
single-React in monorepos), and prints one aligned, actionable report with a
concrete remedy per finding. Encodes [[rfc-bun-package-hygiene]] and lands the
"doctor cluster" together: it reuses the `Bun.which` probe helper from
[[rfc-bun-which]] and the width-aware output utilities from [[rfc-bun-cli-ansi]]
(codified in [[framework/24-bun-builtin-policy]] §24.2).

Composed from Bun builtins — no `which` / `string-width` / advisory-client deps:

| Concern | Bun builtin |
|---|---|
| Toolchain probes | `Bun.which` |
| Security advisories | `Bun.$` → `bun audit --json` |
| Outdated deps | `Bun.$` → `bun outdated --json` |
| Lockfile / config reads | `Bun.file`, the config loader ([[framework/08-config]]) |
| Aligned, wrapped output | `Bun.stringWidth` / `Bun.stripANSI` / `Bun.wrapAnsi` |

## Public surface

### Command

```
patties doctor [--json] [--audit-level <low|moderate|high|critical>]
               [--offline] [--no-audit] [--no-outdated] [--strict]
```

- `--json` — emit a machine-readable report (for CI) instead of the formatted
  one; implies no color.
- `--audit-level <level>` — minimum advisory severity that counts as a **failure**
  (default `high`); lower severities still appear as warnings.
- `--offline` — skip every check that hits the network (audit + outdated); useful
  in air-gapped CI. Reported as "skipped", not "passed".
- `--no-audit` / `--no-outdated` — skip that check group.
- `--strict` — promote every warning to a failure (CI gate).

There is **no `--fix` in Phase 1** (see Phasing). `doctor` is read-only; it
*reports and suggests*, never installs or mutates. Adds a `doctor` verb row to
the CLI dispatch table ([[cli/01-entry]]); all logic lives here.

### Exit codes

- `0` — all checks passed (warnings allowed unless `--strict`).
- `1` — one or more checks failed (a failure-level finding).
- `2` — `doctor` could not run (not a patties project; `bun` missing).

## Checks

Grouped; each group can be skipped by its flag. Every finding carries a status
(`pass` / `warn` / `fail`) and a **one-line remedy** — the exact command to run.

### A. Toolchain

Extends the scaffold's two probes ([[cli/10-scaffold-probes]]: `bun` fail, `git`
warn) to a lifecycle set, reusing the same `Bun.which` helper:

1. **`bun`** present and ≥ the patties-declared minimum version — **fail** if
   missing/old (doctor exits `2` if `bun` itself is absent).
2. **`git`** present — **warn** if missing (versioning is optional but expected).
3. **Conditional probes** (**warn** only), gated on project config so they never
   nag projects that don't use them:
   - `docker` — only if a container deploy target is configured.
   - `claude` — only for `--agent claude` projects (the skill workflow,
     [[cli/19-patties-agent-skill]]).

### B. Dependencies

4. **Security advisories** — run `bun audit --json`; parse, group by severity,
   and surface the count per level with the top advisories. Findings at or above
   `--audit-level` are **failures**; below are **warnings**. (Resolves the RFC's
   open question: severity *is* surfaced and gated, not passed through verbatim.)
   Remedy: the suggested `bun update <pkg>` per advisory.
5. **Outdated deps** — run `bun outdated --json`; **warn** on available updates,
   distinguishing major (behind by a major version) from minor/patch drift.
   Major drift is the louder warning. Never a failure on its own.
6. **Lockfile health** — `bun.lock` exists and is in sync with `package.json`
   (no declared dependency missing from the lock, no version mismatch). Drift is
   a **fail**. Remedy: `bun install`.

### C. Project config

7. **`patties.config.ts` validity** — load it through the config loader and
   validate against the config Zod schema ([[framework/08-config]]). A load error
   or schema violation is a **fail**, reported with the Zod issue path.
8. **Biome config validity** — if a `biome.json` exists, parse it and confirm it
   is well-formed JSON the project's biome version accepts. Malformed → **fail**.
   doctor checks *validity only*; biome owns lint/format (not a goal here).

### D. Monorepo (only when a Bun workspace is detected)

Skipped entirely for single-package projects. When `package.json` declares
`workspaces`:

9. **Workspace resolution** — every `workspaces` glob resolves to a directory
   with a `package.json`; a glob matching nothing is a **fail**.
10. **Single-React invariant** — exactly one resolved copy of `react` /
    `react-dom` across the hoisted tree, per [[framework/26-monorepo-react-resolution]].
    A second copy is a **fail** (it crashes SSR with "Invalid hook call").
    Remedy: the dedupe/catalog-pin guidance from spec 26.
11. **Catalog references** — every `catalog:` reference in a workspace package
    resolves to an entry in the root catalog. A dangling reference is a **fail**.

## Output

A width-aware, aligned report built with the spec-24 §24.2 utilities
(`Bun.stringWidth` for column math, `Bun.wrapAnsi` for remedies that exceed the
terminal width, `Bun.stripANSI` when piped / `--json`). Shape:

```
patties doctor

  Toolchain
    ✓ bun 1.3.6              (≥ 1.3.0 required)
    ✓ git 2.45.1
  Dependencies
    ✗ 1 high severity advisory in left-pad@1.0.0
        → bun update left-pad
    ⚠ 3 outdated (1 major: react 18 → 19)
        → bun outdated   to review
    ✓ lockfile in sync
  Config
    ✓ patties.config.ts valid
    ✓ biome.json valid

  1 failed, 1 warning, 5 passed
```

`--json` emits `{ checks: [{ id, group, status, detail, remedy }], summary }`.

## Behavior

1. Resolve the project root (config discovery, [[framework/08-config]]); if none,
   exit `2`. If `bun` is missing, exit `2` (every other check assumes it).
2. Run check groups; network groups (audit, outdated) run concurrently via
   `Bun.$`, skipped under `--offline`.
3. Aggregate findings; render the report (or JSON).
4. Exit `1` if any finding is `fail` (or any `warn` under `--strict`), else `0`.

## Phasing

- **Phase 1 (0.1.x):** all checks above, read-only. `--json`, exit gating, the
  formatted report. No mutation of the user's project.
- **Phase 2:** `patties doctor --fix` — **conservative and explicit**, one
  confirmation per fix (`bun install` to sync the lockfile, `bun update <pkg>`
  for an advisory). Inherits the bun-which rule: never act on the user's behalf
  without consent. Also `bun patch` workflow checks (`patches/` integrity) and
  scheduled hygiene via `Bun.cron` ([[rfc-bun-cron]]) for nightly audits.

## Non-goals

- **Not a replacement** for `bun audit` / `bun outdated` — doctor aggregates and
  contextualizes them under one command and one exit code.
- **No auto-install / auto-update in Phase 1.** Report and suggest only.
- **No `bun patch` / `patches/` management in v1** — deferred to Phase 2.
- **Not a linter.** Biome owns lint/format; doctor only checks biome *config
  validity*.

## Tests

- **Toolchain:** missing `bun` → exit 2; missing `git` → warn, exit 0; container
  target set but no `docker` → warn; no container target → docker probe skipped.
- **Advisories:** a fixture lockfile with a known advisory at `high` → fail at
  default `--audit-level`; the same at `--audit-level critical` → warn, exit 0.
- **Outdated:** major-behind dep → warn (flagged major); patch-behind → warn
  (not flagged major); neither fails.
- **Lockfile drift:** add a dep to `package.json` without installing → fail with
  `bun install` remedy.
- **Config:** a config that violates the Zod schema → fail with the issue path; a
  valid config → pass.
- **Monorepo:** a workspace with two React copies → single-React fail; a dangling
  `catalog:` ref → fail; a glob matching no package → fail; clean workspace →
  monorepo group passes; single-package project → monorepo group absent.
- **`--offline`:** audit + outdated reported "skipped", never "passed"; exit
  reflects only the checks that ran.
- **`--strict`:** a project with only warnings exits 1.
- **`--json`:** stable machine shape, no ANSI.

## Acceptance criteria

- `patties doctor` on a healthy project prints an all-✓ report and exits 0.
- A high-severity advisory, a lockfile drift, an invalid config, or a duplicate
  React in a monorepo each produces a clear failure with an actionable remedy and
  a non-zero exit.
- `--audit-level`, `--offline`, `--no-audit` / `--no-outdated`, and `--strict`
  behave as specified; `--json` is CI-consumable.
- No check mutates the project in Phase 1.
- The command reuses the `Bun.which` probe helper and the spec-24 §24.2 output
  utilities — no `which` / `string-width` / advisory-client dependency is added.
