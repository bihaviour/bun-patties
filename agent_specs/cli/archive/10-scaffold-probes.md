---
spec: cli/10-scaffold-probes
title: Scaffold tool probes — bun (fail) + git (warn) via Bun.which
status: accepted (implementation pending)
phase: 0
file: packages/create-patties/src/
last_reviewed: 2026-05-27
supersedes: cli/archive/05-create-patties.md (extends, does not replace — adds tool-probe gates before install + git steps); coexists with cli/draft/09-create-patties-dx.md
rfc: rfc-bun-which
---

# CLI Spec 10 — Scaffold tool probes

This spec encodes [[rfc-bun-which]]. It extends the `create-patties`
scaffolder ([[cli/archive/05-create-patties]]) with two probe gates:
fail on missing `bun`, warn on missing `git`.

It is additive to the DX overhaul in
[[cli/draft/09-create-patties-dx|spec 09]] — the probes run before
the template-copy step regardless of which DX flow is active (legacy
flag-driven path or the spec-09 interactive path).

## Goal

Stop the scaffolder from running pipeline steps that need binaries
the user doesn't have. Give a clear, single-line message instead of
letting `bun install` or `git init` fail mid-pipeline and leave half
a project on disk.

## Surface

No new CLI flags. Two probes run silently when their tool is present
and emit a single line each when absent.

## Probe gates

The probe step runs **after** argument parsing and directory
validation, **before** the template copy step from
[[cli/archive/05-create-patties]]'s Behavior list.

```ts
// packages/create-patties/src/probes.ts
export function probeTools(): void {
  if (!Bun.which("bun")) {
    console.error(
      "create-patties: `bun` not found in PATH. " +
      "Install Bun from https://bun.sh and re-run.",
    )
    process.exit(1)
  }
  // git is probed lazily by hasGit() at the git-init step.
}

export function hasGit(): boolean {
  return Bun.which("git") !== null
}
```

### Bun probe (fail)

Bun is required to run the resulting project (`bun dev`, `bun build`).
If `Bun.which("bun")` returns `null`, the scaffolder exits with code
1 and the message above. We do **not** try to install Bun on the
user's behalf.

Edge case: when invoked via `bunx create-patties`, `Bun.which("bun")`
always returns a path. The probe matters when `create-patties` is
invoked from a shell whose PATH has been clobbered, or when shipped
as a standalone binary in the future.

### Git probe (warn)

Git is used for the optional `git init && git commit` step. If
`Bun.which("git")` returns `null`:

- Skip the git-init step entirely.
- Print a single warn line **after** the scaffold otherwise succeeds:
  ```
  create-patties: `git` not found — skipping `git init`.
  ```

The existing `--no-git` flag continues to skip the git step
regardless of probe outcome.

## Behavior changes vs [[cli/archive/05-create-patties]]

The Behavior numbered list gains one new step (`3a`) and amends one
existing step (was step `9`):

- **3a. NEW — `probeTools()` runs.** Exits 1 if `bun` is missing.
  Runs before any filesystem writes to the target directory.
- **9. Git step (amended).** Unless `--no-git` is set, _and_
  `hasGit()` returns true, run `git init && git add -A && git commit`
  as today. If `hasGit()` returned false, emit the warn line and
  skip the git step.

No other Behavior steps change.

## Non-goals

- **Probing `claude`, `docker`, `node`, or any other tool.** Out of
  scope. When a `patties doctor` command spec opens, those probes
  belong there. This spec consciously stops at the two probes that
  gate scaffold-time pipeline steps.
- **Auto-installing missing tools.** We never try to install bun,
  git, or anything else on the user's machine.
- **Network probes.** No connectivity checks.
- **Bun version-floor enforcement.** Bun's presence is what matters
  here. Version-floor is a separate concern; open a follow-up RFC
  if we ever ship a feature that requires a minimum Bun version.

## Acceptance criteria

- `bunx create-patties foo` on a machine with both `bun` and `git`
  completes successfully with no probe messages visible.
- `bunx create-patties foo` on a machine with `bun` but no `git`
  completes the scaffold and emits exactly one warn line about git;
  the target directory contains no `.git/`.
- `bunx create-patties foo` invoked in an environment where
  `Bun.which("bun")` returns `null` exits with code 1 and the error
  message, having created no files in the target directory.
- `--no-git` continues to skip git init even when git is present.

## Test plan

- Unit: stub `Bun.which` to return `null` for `"bun"` → assert
  `probeTools()` calls `process.exit(1)` after printing the error.
- Unit: stub `Bun.which` to return `null` for `"git"` only → assert
  `hasGit()` returns `false` and the scaffold prints the warn line.
- Integration: full scaffold in a sandbox where `git` is removed
  from PATH → assert no `.git/` directory in the result and the
  warn line appears in stdout.
- Integration: same, with `bun` removed from PATH → assert exit 1
  and no target directory created.

## Out of this spec

A future `patties doctor` command spec is the right home for richer
probes (claude, docker, lockfile freshness, biome config). This
spec consciously stops short of inventing that surface.
