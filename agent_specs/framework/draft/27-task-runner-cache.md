---
spec: framework/27-task-runner-cache
title: Task runner + output cache (patties run)
status: draft
phase: dev-dx
file: src/cli/run.ts
last_reviewed: 2026-05-31
source: rfc-bun-task-cache (verdict accept, 2026-05-31)
---

# Spec 27 — Task runner + output cache (`patties run`)

## Purpose

Give Bun-workspace monorepos ([[cli/18-create-patties-redesign]]) the one thing
Bun workspaces lack at CI scale: **task-output caching** and **affected
detection**. `patties run <task>` wraps `bun --filter` (keeping its topological
order and TUI) with a content-addressed cache — on a hit it restores a task's
declared outputs and replays its log instead of re-running. Built entirely on
Bun builtins (`Bun.CryptoHasher`, `Bun.Glob`, `Bun.Archive`, `bun:sqlite`,
`Bun.$`, `Bun.spawn`; `Bun.s3` in Phase 2) — no Turborepo/Nx. Encodes
[[rfc-bun-task-cache]].

This is a build/CI concern, not a dev-loop concern: `patties dev`
([[framework/05-dev-hmr]]) is untouched.

## Public surface

### Command

```
patties run <task> [--filter <pattern>] [--affected] [--since <ref>]
                   [--no-cache] [--force] [--dry-run]
                   [--concurrency <n>] [--remote]   # --remote is Phase 2
```

- `--filter` — same patterns as `bun --filter` (name / path / glob); default all
  workspace packages that define `<task>`.
- `--affected [--since <ref>]` — restrict to packages changed since `<ref>`
  (default `origin/main`) and their transitive dependents.
- `--no-cache` — run, do not read or write the cache. `--force` — ignore hits,
  run, but still write. `--dry-run` — print each unit's hit/miss **and the
  reason the key changed**; run nothing.
- Bare `patties build` / `dev` are unchanged; `run` is the opt-in orchestrator.

### Config (`patties.config.ts`)

A `tasks` block, validated by the config Zod schema ([[framework/08-config]]):

```ts
tasks?: Record<string, {
  inputs?: string[];   // globs; default: package files minus outputs + gitignored
  outputs?: string[];  // globs; default: [] (nothing cached to restore)
  env?: string[];      // env var names/globs whose VALUES feed the cache key
  cache?: boolean;     // default true; false = always run, never store
}>
```

Topological ordering is already provided by `bun --filter` — there is **no**
`dependsOn` field; the runner relies on Bun for order.

### Cache store

```
.patties/cache/
  index.sqlite          // bun:sqlite (WAL): key → { outputs[], exitCode, logRef, createdAt, bytes }
  <key>.tar.gz          // Bun.Archive of the task's declared outputs
  <key>.log             // captured stdout/stderr
```

Writes are crash-safe: tarball/log written to a temp name then atomically
renamed; the `index.sqlite` row is inserted last so a half-written entry is
never observable as a hit.

## Cache key

The single correctness-critical artifact. `key = sha256(canonical-serialize[…])`
over **all** of the following — conservative by design (over-invalidate before
risking a stale hit):

1. **`cacheFormatVersion`** — bumped by the runner to invalidate every entry
   when the keying logic changes.
2. **`taskName` + the resolved command string**.
3. **`inputsHash`** — sorted `[relPath, blobSHA]` over the task's `inputs`
   globs, excluding `outputs` and gitignored paths. Tracked files reuse git's
   blob SHA (`git ls-files -s`); untracked files are hashed with
   `Bun.CryptoHasher`.
4. **`externalDeps`** — this package's resolved dependency versions +
   integrity hashes from `bun.lock` (its dep closure only, not the whole
   lockfile, to avoid over-invalidation).
5. **`internalDepKeys`** — the computed cache keys of this package's workspace
   dependencies. (Topological order guarantees they are computed first.) This
   term is what makes a plain `patties run build` affected-correct: a leaf
   change rekeys every dependent.
6. **`globalInputs`** — content hashes of root `patties.config.ts`, root
   `tsconfig.json`, and the package's own `package.json`.
7. **`envValues`** — values of env vars matched by `task.env` (sorted).
8. **`toolVersions`** — `Bun.version` + the patties version.
9. **`platform`** — `process.platform` + `process.arch`.

## Behavior

### Per task (in `bun --filter` topological order)

1. Compute `key`.
2. If `!--force` and not `--no-cache` and `index.sqlite` has `key`: extract
   `<key>.tar.gz` into the package dir, replay `<key>.log`, mark **hit**, skip.
3. Else `Bun.spawn` the command with `cwd` = the package dir, streaming output.
   On exit 0 and caching enabled: `new Bun.Archive(glob(outputs))` → write
   `<key>.tar.gz` + `<key>.log`, then insert the index row. On non-zero exit:
   propagate the failure, write nothing.
4. `--dry-run` stops after step 1 and reports hit/miss + the first differing
   key component.

### Affected detection (the `--affected` optimization)

1. `base = git merge-base <--since|origin/main> HEAD` (via `Bun.$`).
2. `changed = git diff --name-only ${base}...HEAD` + untracked → map each path
   to the owning workspace package by directory prefix. A root-level change
   (root config, `bun.lock`) marks **all** packages.
3. `affected = changed ∪ transitive dependents` via the reverse graph built
   from `workspace:` deps.
4. Hand `affected` package names to `bun --filter` for the task.

Affected detection is an *optimization*: with the `internalDepKeys` term,
running the task across **all** packages is already correct — unchanged
packages are cache hits. `--affected` skips even the hit lookups and powers
"test only what changed."

## Phasing

- **Phase 1 (local):** everything above. Local cache, affected detection,
  `--dry-run` / `--no-cache` / `--force`.
- **Phase 2 (remote):** `--remote` checks an S3-compatible bucket via `Bun.s3`
  on local miss (HEAD/GET `<key>.tar.gz`), restores, and warms the local store;
  writes back on miss. Credentials/endpoint read from env by `Bun.s3`.
  Vendor-neutral — GitHub Actions cache, R2, MinIO, self-hosted are all just
  buckets. Adds a basic size/age prune.

## Non-goals

- Caching long-running `patties dev` — build/test tasks only.
- A general dependency-dedup or polyglot task model — JS/Bun packages only;
  polyglot is deferred ([[cli/18-create-patties-redesign]]).
- A `dependsOn` task-graph DSL — `bun --filter` owns ordering.
- Remote-cache GC/quota policy beyond size/age prune.

## Tests

- **Key determinism:** identical inputs → identical key; changing each of the
  nine components in isolation changes the key (one test per component).
- **Hit/restore:** run a task, mutate nothing, re-run → cache hit, outputs
  restored byte-identical, command not spawned (assert via a sentinel side
  effect that would re-fire on a real run).
- **Invalidation propagation:** edit a leaf package → it and its dependents
  miss; unrelated packages hit.
- **Affected:** `--affected --since <ref>` runs only changed + dependents;
  root-config change → all.
- **Crash safety:** kill mid-write → no observable hit for the partial key;
  next run recomputes.
- **`--dry-run`:** reports the differing key component without running.
- **Non-determinism guard:** a task with non-deterministic output is detectable
  (document the failure mode; caching such a task is user error).

## Acceptance criteria

- `patties run build` across a Bun-workspace monorepo caches outputs; a no-op
  re-run is near-instant with zero task spawns.
- A change to one package rebuilds exactly it + its transitive dependents;
  everything else restores from cache.
- `patties run test --affected --since origin/main` runs only affected
  packages.
- `--dry-run` explains every hit/miss; `--no-cache` / `--force` behave as
  specified.
- The cache is sound: no stale hit across any of the nine key components.
- Phase 2 `--remote` warms from and writes to an S3-compatible bucket with no
  vendor account required.
