---
rfc: bun-task-cache
title: Bun-native task-output cache + affected detection (monorepo runner)
status: encoded
verdict: accept
opened: 2026-05-31
reviewed: 2026-05-31
encoded_in: ["framework/27-task-runner-cache"]
encoded_on: 2026-05-31
target_phase: post-launch (dev-dx)
affects_specs: [cli/18-create-patties-redesign]
bun_unique: Bun-builtin (composes CryptoHasher + Archive + bun:sqlite + Bun.s3 + bun --filter)
host_subsystem: framework/27-task-runner-cache
comparable_elsewhere: Turborepo (local+remote cache, JS-only; clean self-host). Nx (cache + affected, heavier; official free self-host cache deprecated May 2026 after CVE-2025-36852). Bazel/Pants (polyglot, heavy). Node has no built-in equivalent.
---

## Review verdict (2026-05-31)

**Accept**, encoded as framework spec 27
([[framework/27-task-runner-cache]]). Build the cache on Bun builtins
rather than adopt Turborepo/Nx — consistent with the Bun-builtin policy
([[framework/24-bun-builtin-policy]]) and the framework's value framing.
**Deferred priority:** ships *after* the single-React prerequisite
([[framework/26-monorepo-react-resolution]]) and the scaffolder
([[cli/18-create-patties-redesign]]); not required until a real monorepo hits
CI-scale build times. Parking it costs nothing — a third-party orchestrator (or
this) layers onto the same `package.json` scripts later with no migration.

Resolved open questions (scope pins):

- **Runner home** — a new framework subsystem, `patties run` (spec 27), **not**
  an extension of the dispatch entry. CLI dispatch ([[cli/01-entry]]) gains only
  a `run` verb row; all cache logic lives in spec 27.
- **Phasing** — **Phase 1 = local cache + affected detection.** Phase 2 = remote
  cache via `Bun.s3`. No remote in v1.
- **Config home** — a `tasks` block in `patties.config.ts` (consistent with the
  `ui` / `agentsMd` blocks), validated by the config Zod schema. No separate
  file.
- **Cache-key global-input set** — pinned in spec 27 § "Cache key": command +
  declared inputs (content) + this package's resolved deps from `bun.lock` +
  internal-dep keys + root `patties.config.ts`/`tsconfig.json` + the package's
  own `package.json` + env-allowlist values + Bun & patties versions + platform
  (os/arch) + a cache-format version. **Conservative by design — over-invalidate
  before ever risking a stale hit.**

Out of scope:

- Caching long-running `patties dev` processes — build/test tasks only.
- A general dependency-dedup or polyglot task model — JS/Bun packages only;
  polyglot stays deferred ([[cli/18-create-patties-redesign]]).
- Remote-cache GC/quota beyond a basic size/age prune (a Phase 2 detail).

---

# RFC — Bun-native task-output cache + affected detection

> Continuation of [[cli/18-create-patties-redesign]] (monorepo option) and
> [[cli/19-patties-agent-skill]]. Spec 18 scaffolds a **Bun-workspace**
> monorepo and defers third-party orchestrators (Turborepo / Nx). Bun
> workspaces already give topological `bun --filter` execution and catalogs;
> the one gap at scale is **task-output caching** and **affected detection**.
> This RFC proposes building that gap on Bun builtins instead of adopting
> Turborepo — keeping the monorepo story 100% bun-native with no surfaced
> exception to the bun-native rule.

## Summary

A `patties` task runner that wraps `bun --filter` with a content-addressed
cache: hash a task's inputs (source, deps, config, internal-dep cache keys,
tool versions) into a key; on a hit, restore the task's declared outputs and
replay its log instead of running; on a miss, run it and store the outputs.
Affected detection (`git diff` + reverse workspace graph) is layered on top as
an optimization. Optional vendor-neutral remote cache via `Bun.s3`.

Composed entirely from Bun builtins — no Turborepo, Nx, or third-party cache
server:

| Mechanism | Bun builtin |
|---|---|
| Cache key | `Bun.CryptoHasher("sha256")` |
| Input enumeration | `Bun.Glob` |
| Fast file hashes (reuse git's blob SHAs) | `Bun.$` → `git ls-files -s` |
| Changed files vs base ref | `Bun.$` → `git diff --name-only` |
| Run + capture task | `Bun.spawn` |
| Pack / restore outputs | `Bun.Archive` (tar.gz) — same builtin adopted by [[rfc-bun-archive]] |
| Cache index | `bun:sqlite` |
| Optional remote cache | `Bun.s3` |
| Topological task ordering | `bun --filter` (already native) |

## Motivation

Spec 18's monorepo option is Bun-workspaces-only. That scales well for
structure (catalogs, `workspace:` linking, one lockfile) and for ordered
execution (`bun --filter '*' build` runs deps before dependents). It does **not**
cache task outputs or detect affected packages, so every push rebuilds and
re-tests everything. In CI on a large repo this is the difference between a
20-second and a 10-minute pipeline — the exact pain Turborepo/Nx exist to
solve.

The framework already treats "a Bun builtin replaces a Node-era dependency" as
first-class value (see the Bun-builtin policy, [[framework/24-bun-builtin-policy]],
and the RFC family `rfc-bun-*`). Caching + affected detection is not magic; it
is a hashing layer plus a git diff plus the workspace graph. With `Bun.Archive`
(1.3.6) and `Bun.s3` (1.2) now in core, the whole feature can be built without
a third-party orchestrator — and the remote cache is vendor-neutral by
construction because *we* own the key→blob mapping (unlike Nx, whose free
self-host cache plugins were deprecated in May 2026).

## Proposal

### Command surface

```
patties run <task> [--filter <pattern>] [--affected] [--since <ref>]
                   [--no-cache] [--force] [--dry-run] [--remote]
```

`patties run` wraps `bun --filter` (preserving its topological order and TUI)
and adds the cache layer around each `(package, task)` unit. Bare `patties
build` / `dev` are unchanged; the runner is opt-in for monorepo orchestration.

### Cache key

```
key = sha256(
  taskName + command
  + inputsHash      // sorted [relPath + gitBlobSHA] over the task's `inputs` globs
  + externalDeps    // this package's resolved versions from bun.lock
  + Σ dep.cacheKey  // internal workspace deps' keys  ← propagates invalidation
  + globalInputs    // root config, tsconfig, env allowlist values
  + toolVersions    // bun + patties versions
)
```

The `Σ dep.cacheKey` term is load-bearing: folding each internal dependency's
key into its dependents' keys gives **affected-correctness for free** — change
a leaf package and every transitive dependent's key changes (so they rebuild),
while everything else stays a cache hit. This means a plain `patties run build`
across all packages is already correct; affected detection is purely an
optimization on top.

**Speed:** do not re-hash files — `git ls-files -s` returns the blob SHA git
already computed for every tracked file; only untracked files are hashed with
`Bun.CryptoHasher`. This keeps keying fast on large repos.

### Per-task algorithm

```
key = computeKey(pkg, task)                       // in bun --filter topo order
if !flags.force && cache.has(key):                // bun:sqlite lookup
    Bun.Archive(cache.tarball(key)).extractTo(pkgDir)   // restore outputs
    replay(cache.log(key)); markHit(key)
else:
    proc = Bun.spawn(command, { cwd: pkgDir })    // run + capture stdout/exit
    if proc.exitCode == 0 && !flags.noCache:
        const tar = new Bun.Archive(glob(task.outputs))    // tar.gz outputs
        cache.put(key, tar.toBytes(), proc.log, proc.exitCode)
```

### Affected detection (optimization layer)

```
base    = $`git merge-base ${flags.since ?? "origin/main"} HEAD`
changed = filesToPackages($`git diff --name-only ${base}...HEAD`)  // root files ⇒ all
affected = reverseGraphClosure(changed)            // graph from workspace: deps
$`bun --filter ${affected.map(p => p.name)} ${task}`   // or run all + let cache skip
```

### Config shape (the `turbo.json` equivalent, in patties)

```ts
// patties.config.ts
tasks: {
  build: {
    inputs:  ["src/**", "app/**", "patties.config.ts", "tsconfig.json"],
    outputs: ["dist/**", ".patties/build/**"],
    env:     ["NODE_ENV", "PATTIES_*"],   // env values that affect output → into the key
    // ordering is already handled by `bun --filter`; no `dependsOn` needed for it
  }
}
```

### Cache store

```
.patties/cache/
  index.sqlite          // bun:sqlite: key → { outputs, exitCode, logRef, createdAt, size }
  <key>.tar.gz          // Bun.Archive of the task's declared outputs
  <key>.log             // captured stdout/stderr
```

Remote cache (`--remote`, phase 2) is the same map backed by `Bun.s3`: on a
local miss, HEAD/GET `<key>.tar.gz` from any S3-compatible bucket, restore, and
warm the local store. Configured by an S3 endpoint + credentials in env (which
`Bun.s3` reads natively). Vendor-neutral: GitHub Actions cache, R2, MinIO,
self-hosted — all just buckets.

### Phased rollout

- **Phase 1 (local):** `patties run`, content-addressed local cache
  (`CryptoHasher` + git SHAs + `bun:sqlite` + `Bun.Archive`), `--affected
  --since`, `--no-cache` / `--force` / `--dry-run`.
- **Phase 2 (remote):** `--remote` via `Bun.s3`, byte-deterministic archives,
  cache GC/pruning by size/age.

## Trade-offs

- **Cache-key correctness is the whole game, and it is the multi-year
  edge-case work Turborepo/Nx have already banked.** Building our own means
  owning that burden: under-hashing an input produces a *silent* stale/wrong
  build — the worst failure mode. Mitigations: conservative default inputs,
  a `--no-cache` / `--force` escape hatch, and `--dry-run` that prints each
  unit's hit/miss **and why** (which input changed the key).
- **Determinism becomes load-bearing.** Caching is only sound if `patties
  build` is deterministic. The build-time-discovery rule already mandates
  this, but it graduates from "nice" to "required."
- **Scope.** This is a real sub-project, not a flag. It earns its keep only
  for users who actually hit CI-scale monorepos; small repos see no benefit
  and should not be forced onto `patties run`.
- **Adopting Turborepo would be less work** and offload correctness — at the
  cost of a Node-ecosystem dependency and a surfaced exception to the
  bun-native rule. This RFC trades that for purity + a vendor-neutral remote
  cache the framework controls end to end.

## Open questions

_The runner home, phasing, config home, and the cache-key input set are
resolved in the verdict above and pinned in spec 27. These remain open as
implementation-validation items:_

- **Cache-key completeness validation** — the pinned input set is conservative,
  but confirm against real cases that nothing output-affecting leaks in
  unhashed (locale, timezone, the system `git` version if used for SHAs). The
  `--dry-run` "why did the key change" output is the verification tool.
- **Concurrency** — parallel `--filter` writers hitting `index.sqlite`. Use WAL
  mode + write-temp-then-rename for tarballs to avoid torn writes. Verify under
  high `--filter` fan-out.
- **Output fidelity** — symlinks, file permissions, empty dirs. Inherits
  whatever `Bun.Archive` preserves (see [[rfc-bun-archive]] symlink open
  question); confirm round-trip equality.
- **Affected base ref in CI** — `origin/main` is the default; document
  shallow-clone / detached-HEAD handling so `git merge-base` resolves in CI.
