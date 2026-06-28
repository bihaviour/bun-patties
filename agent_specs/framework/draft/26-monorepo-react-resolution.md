---
spec: framework/26-monorepo-react-resolution
title: Monorepo React single-copy resolution
status: draft
phase: dev-dx
file: src/cli/dev.ts
last_reviewed: 2026-05-31
---

# Spec 26 — Monorepo React single-copy resolution

## Purpose

The `--monorepo` scaffold option ([[cli/18-create-patties-redesign]]) puts each
app under `apps/<app_name>/` in a Bun workspace, which **hoists** shared
dependencies to the workspace-root `node_modules`. The dev server's existing
single-React guarantee assumes a flat layout where `react` lives in
`<cwd>/node_modules`. Under hoisting that assumption breaks and SSR can load
**two copies of React**, crashing on the first hook with *"Invalid hook
call."* This spec makes the framework's bin + React resolution
**workspace-aware** so the monorepo option works at all. It is a correctness
prerequisite for `--monorepo`, independent of the task-cache work
([[rfc-bun-task-cache]]).

## Background — why one React

React hooks read a module-level dispatcher inside the `react` package; the
renderer (`renderToReadableStream`) sets that dispatcher before rendering. App
components, react-dom/server, and `react` must all resolve to the **same**
`react` instance in memory. If components import hooks from one copy while the
renderer set the dispatcher on another, the components see an empty dispatcher
→ "Invalid hook call" during SSR. The failure is a *duplicate-module* problem,
not a misplaced-call problem.

Two copies appear when two `node_modules/react` exist on disk and different
importers resolve to different ones — classically when `patties` is installed
via a **symlink** (workspace link / `bun link`): the runtime realpaths the
symlink, so framework files `import "react"` from the framework checkout's own
`node_modules` instead of the app's.

## Current behavior (flat apps)

`src/cli/dev.ts` already solves the flat case with two coordinated moves:

1. **`--preserve-symlinks`** (`dev.ts:113`) — the dev process re-execs under
   `bun --preserve-symlinks`, so symlinks are **not** realpath'd. Framework
   files keep their logical path under `<cwd>/node_modules/patties/...`, so
   their `import "react"` walks up to `<cwd>/node_modules/react` — the app's
   single copy.
2. **`resolveReexecEntry`** (`dev.ts:147`) — prefers launching the bin from
   `<cwd>/node_modules/patties/bin/patties.ts` (the logical app-tree path) over
   `process.argv[1]` (which may already be realpath'd into the framework
   checkout), anchoring the whole process inside the app tree.

This is airtight when there is exactly one `react`, at `<cwd>/node_modules`.

## The monorepo gap

Bun workspaces hoist shared deps to the **root**, not each app:

```
my-monorepo/
  node_modules/{react, react-dom, patties}   ← the ONE hoisted copy of each
  apps/web/
    node_modules/                            ← react usually NOT here
    app/  patties.config.ts  package.json
```

Two assumptions in the current code break when `cwd = apps/web`:

- `resolveReexecEntry` probes `<cwd>/node_modules/patties/bin/patties.ts`. That
  path does **not** exist (patties is hoisted to the root), so it falls back to
  `process.argv[1]` — losing the app-tree anchoring.
- Even with `--preserve-symlinks`, resolution must climb from `apps/web` up to
  the **root** `node_modules/react`. A stray nested `react` in an app (e.g. a
  version pin that forces a non-hoisted install) silently reintroduces a second
  copy.

## Proposed changes

### 1. Upward bin search

Replace the single-path probe in `resolveReexecEntry` with a climb from `cwd`
through parent `node_modules` directories up to the filesystem root, returning
the nearest existing `node_modules/patties/bin/patties.ts`:

```ts
function resolveReexecEntry(cwd: string): string {
  let dir = cwd;
  while (true) {
    const candidate = `${dir}/node_modules/patties/bin/patties.ts`;
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return process.argv[1] ?? "";
}
```

In a hoisted monorepo the nearest hit is the workspace-root copy — restoring
the anchor. In a flat app the first iteration matches, so behavior is
unchanged. (Stop at the first `node_modules/patties` found; do not keep
climbing past it — a nested install is intentional if present.)

### 2. Keep `--preserve-symlinks`, anchored from the resolved entry

`--preserve-symlinks` stays on. Because the re-exec entry (change 1) now points
at the hoisted `patties`, `react` / `react-dom` resolve up to the single
hoisted copy regardless of whether `cwd` is the app dir or the root.

### 3. Single-React guard (doctor check)

Before booting the dev server (and as a `patties doctor` check, if/when that
command exists), assert exactly one `react` is reachable from the app entry.
Use `Bun.resolveSync("react/package.json", appDir)` plus a scan for any nested
`node_modules/react` under the app that resolves to a different realpath. If a
second copy is found, fail fast with both paths and the fix, e.g.:

```
✗ Two copies of React detected — SSR hooks will crash.
    apps/web → /my-monorepo/node_modules/react        (1903.x)
    nested  → /my-monorepo/apps/web/node_modules/react (1900.x)
  Align the version so Bun can hoist a single copy, then `bun install`.
```

This converts the cryptic runtime "Invalid hook call" into an actionable
boot-time error.

## Build / start

`patties build` resolves `react` through `Bun.build` from the generated server
entry (written under the app's `.patties/`), which walks up to the hoisted root
naturally — so the compiled bundle embeds one React. This spec's changes are
primarily a **dev re-exec** concern, but the acceptance tests below cover a
monorepo `build` + `start` to confirm production SSR is also single-copy.

## Non-goals

- Supporting two *intentional* React versions in one app — unsupported by
  React itself; out of scope.
- A general dependency-deduplication tool — this is React-specific because the
  failure mode is React-specific. Other duplicate deps are the user's concern.
- Changing the flat-app behavior — changes 1–2 are no-ops there.

## Tests

- `resolveReexecEntry` unit test: in a synthetic `apps/web` tree with `patties`
  only at the root `node_modules`, returns the root bin path (not the
  argv fallback); in a flat tree, returns the local bin path (unchanged).
- Integration: scaffold `--type fullstack --monorepo`, `bun install`,
  `bun --filter web dev`, request a route that calls a hook during SSR →
  renders without "Invalid hook call".
- Integration: same monorepo, `patties build` + `patties start` → SSR route
  renders (production single-copy).
- Doctor guard: plant a nested `apps/web/node_modules/react` at a different
  version → boot fails with both paths listed, exit non-zero.

## Acceptance criteria

- A `--monorepo` app's `patties dev` SSRs hook-using pages with no duplicate
  React, whether `react` is hoisted to the root or pinned in the app.
- `resolveReexecEntry` finds the hoisted `patties` bin by climbing parent
  `node_modules`; flat-app resolution is byte-for-byte unchanged.
- A second reachable `react` fails at boot with a clear message naming both
  paths, instead of crashing later with "Invalid hook call."
- Monorepo `build` + `start` produce single-copy production SSR.
