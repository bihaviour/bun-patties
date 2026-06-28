---
rfc: bun-which
title: Bun.which — scaffold tool probes (bun + git)
status: encoded
encoded_in: ["cli/draft/10-scaffold-probes"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: 0
affects_specs: [cli/05-create-patties, cli/09-create-patties-dx, cli/10-scaffold-probes]
bun_unique: Bun-builtin
host_subsystem: cli/archive/05-create-patties (scaffold) — additive
comparable_elsewhere: Node uses `which` npm package. Next CLI / Astro CLI use it via deps. POSIX shells have the `which` / `command -v` builtins.
---

## Review verdict (2026-05-27)

**Accept.** Smallest possible scope: two probes, no new flags, no
new CLI surface. Fails fast on missing `bun` (the scaffolder needs
it to run `bun install`), warns on missing `git` (skips the optional
git init), uses `Bun.which()` which is one-line per probe. Saves
the `which` npm dep and matches what users expect from polished
scaffolders.

Scope pins:
- **Two probes only.** `bun` (fail) + `git` (warn). No `claude`,
  `docker`, `node`, etc.
- **Probes run before template copy.** If `bun` is missing, the
  user's filesystem is untouched.
- **No auto-install.** We never install tools on the user's behalf.
- **`--no-git` still wins.** User opt-out continues to work as
  today.

Out of scope for this RFC:
- **`patties doctor` command.** Richer probes (claude, docker,
  lockfile freshness, biome config) belong in a future doctor spec,
  not in `create-patties`.
- **Cross-platform `which` quirks.** Bun's implementation handles
  `.exe` on Windows; this RFC trusts that.
- **Bun version-floor enforcement.** Out of scope for this RFC.

---

# RFC — Bun.which → scaffold tool probes

## Summary

`Bun.which("git")` returns the absolute path of the executable in
`PATH`, or `null`. Use it in `create-patties` to (a) fail fast if
`bun` is missing and (b) warn + skip git init if `git` is missing.

## Motivation

`create-patties` today runs `bun install` and `git init` blind: if
either binary is missing, the user gets a confusing mid-pipeline
failure with half a project on disk. A pre-flight probe takes ~5
lines to write and makes the failure mode either
fail-fast-with-message (bun missing) or scaffold-cleanly-with-
warning (git missing).

`Bun.which` is the right primitive: built-in, cross-platform,
handles `.exe` resolution on Windows, returns `null` on miss
without throwing.

## Proposal

### Probe module

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
}

export function hasGit(): boolean {
  return Bun.which("git") !== null
}
```

### Behavior changes

`probeTools()` runs after arg-parse + directory-validate, before
template copy. The git-init step (was step 9 in the existing
behavior list) consults `hasGit()` and prints a warn line if false.

## Trade-offs

- **`bun` probe is theoretically redundant under `bunx`** — but
  defends against shipped-binary / clobbered-PATH cases. Cheap
  insurance.
- **Warn-only on `git`** rather than fail keeps the scaffold
  useful for users on locked-down corporate machines without git.

## Open questions

- Should we surface bun version too (`Bun.version` >= some
  minimum)? Deferred — separate concern; if we ever bump a
  minimum Bun version, open a follow-up RFC.
- Cross-platform `which` behavior on Windows verified by Bun's
  implementation; not re-verified here.
