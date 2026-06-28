---
spec: framework/17-dev-island-bundler
title: Dev-time island bundling — design decision
status: accepted (implementation spec pending)
phase: dev-dx
file: src/dev/, src/cli/dev.ts, src/render/, src/server/
last_reviewed: 2026-05-27
---

# Spec 17 — Dev-time island bundling

This spec exists to **decide** how Patties produces hydrated islands during
`patties dev`. It is not yet an implementation plan. The recommendation
section at the end is the proposal to argue with.

## Problem

`patties dev` today only does SSR. Islands render to HTML but ship no
client JS, so a `useState` / `useEffect` in `app/islands/*.tsx` is dead
until the user runs `patties build`. The first impression for a new user
is "the framework is broken" — Counter prints to the page but the button
doesn't do anything.

The fix is, mechanically, "run `Bun.build` somewhere during dev". The
question is _where_, _when_, and _at what cost_.

## Constraints we will not break

1. **Build-time-discovery rule** (`.claude/rules/build-time-discovery.md`).
   The production server bundle must not call `scanIslands` /
   `scanRoutes` / `Bun.Glob` / `Bun.build` at runtime. Dev is the
   documented exception. Whatever lives in `src/dev/` must never be
   reachable from `src/server/` or the generated production server entry.
2. **Bun-native rule.** No new bundler. `Bun.build` only.
3. **Web-standards boundary.** Whatever ships client JS to the browser
   does so via a normal `Response` from a normal route. No bespoke asset
   pipeline that hides behind a non-standard handler shape.
4. **Optional AI rule** is unaffected (this work is unrelated to AI).

## Options

The decision has three roughly-independent axes. The combinations matter,
but each axis can be argued on its own.

### Axis A — When does the bundle happen?

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A1. Startup only** | Bundle every island once at `patties dev` boot. Rely on `bun --hot` re-running the dev entry to pick up changes. | Simple. Browser always gets a chunk URL that is valid for the life of the process. | Adding a new island file mid-session does nothing until restart. Worst case for cold-start time. |
| **A2. Startup + eager on-change rebuild** | Bundle once at boot; on every island file save, immediately rebuild that island and publish the HMR message. | Matches user expectation of HMR. Build errors surface at save time. | Wastes CPU when the user does a sweep edit across many island files but isn't currently looking at the page. |
| **A2′. Startup + lazy rebuild (chosen)** | Bundle once at boot. On save, mark the island _dirty_ and publish the HMR message but do **not** rebuild yet. The browser, on receiving HMR, re-fetches the chunk URL; that GET triggers the rebuild for any dirty island. | Pre-built so first page load is instant. Edits to files the user never views never trigger a build. Naturally throttles to "rebuild what's actually viewed". | Build errors from saved-but-not-viewed files surface only when the user navigates to a page that uses them (acceptable — overlay still shows them then). |
| **A3. Fully lazy per-request** | No upfront bundle. First request for `/_patties/client/Counter.js` triggers a build for that island. Cache result, mark dirty on change. | Zero cold-start cost. | First page load is slow (must compile every island the page uses). |

**Decision:** **A2′**. The eager startup pre-bundle keeps first page load
fast; the lazy rebuild keeps the inner loop cheap when the user is editing
files they aren't currently looking at. The HMR message still goes out
immediately on save so the browser triggers the rebuild by re-fetching;
nothing in the watcher contract changes.

### Axis B — Where do the chunks live?

| Option | Description | Pros | Cons |
|---|---|---|---|
| **B1. On disk under appDir** (e.g. `.patties-dev/client/`) | Bun.build writes to disk; static route serves them with `Bun.file()`. | Native `Bun.build` output path; browser gets `Content-Length`, sourcemap URLs work without extra glue; survives a Bun crash for inspection. | Requires gitignore entry. Temp dir cleanup on dispose. |
| **B2. On disk under OS temp** | Same as B1 but under `os.tmpdir()`. | No gitignore entry needed. | Less inspectable. OS temp cleanup quirks across platforms. |
| **B3. In memory** | Capture `Bun.build` output as `Blob`s; serve from a `Map<url, Response>`. | Zero disk footprint. No cleanup. | Have to wire sourcemap URLs manually. Restart loses chunks. Memory grows with rebuild churn unless we GC old chunks. |

**Decision:** **B1**. `create-patties` adds `.patties-dev/` to the
template `.gitignore` (see CLI spec 09).

### Axis C — Who owns the bundler lifecycle?

| Option | Description | Pros | Cons |
|---|---|---|---|
| **C1. CLI owns it** | `src/cli/dev.ts` starts the bundler before importing user's `app/server.ts`, passes the handle to `start({ bundler })`. | Users get bundling for free with the default template. Easy to disable for advanced users (they just don't read `opts.bundler`). | Extends the `start(opts)` contract (a new required field). Existing scaffolded `server.ts` files break unless we make it optional. |
| **C2. User entry owns it** | `app/server.ts` imports `startDevBundler` from `patties/dev` and wires it itself. CLI knows nothing about it. | No contract change. Maximum user control. | Every scaffolded `server.ts` has eight extra lines of boilerplate. Easy to forget — and forgetting reproduces today's bug. |
| **C3. Renderer owns it** | `createRenderer({ dev: true })` lazily starts a bundler when it sees its first island reference. | Zero wiring for the user. | Magic. The renderer suddenly has filesystem and bundler responsibilities; violates "renderer just renders". Hardest to test. |

**Decision:** **C1**. CLI owns the bundler; passes it into `start({
..., bundler })` as an optional field so user-authored `server.ts` files
written before this spec keep working. The `create-patties` template
(CLI spec 09) consumes it.

### Axis D — Chunk URL prefix and cache headers

**Decision:** prefix `/_patties/client/` (identical to production build
output, so DevTools inspection feels the same in both modes).
`Cache-Control: no-store`, stable (non-hashed) filenames. Dev rebuilds
are frequent; chunk names stay stable so HMR notifications don't have to
carry a new URL each time. Production's hashed-filename + long-cache
strategy is unchanged and lives in `src/build/`.

## Risks worth naming

- **Startup latency.** Option A2 + B1 adds bundle time to `patties dev`
  cold start. For a Counter-sized island this is sub-second on an M-series
  Mac; we have no number for "20 islands". Mitigation: instrument
  `startDevBundler` from day one (log `[dev] islands bundled in Xms`) so
  regressions are visible.
- **Build-error UX.** In A3 the error surfaces mid-request. In A2 it
  surfaces at startup, which is good, but a _later_ broken edit needs to
  show up somewhere the user notices. Today `src/render/dev-error.tsx`
  renders SSR errors; we extend it to also render the most recent island
  build error if there is one. This is the only part that touches the
  renderer.
- **Production bundle contamination.** Real risk if someone imports
  `src/dev/bundler.ts` from a shared module. Mitigation: keep
  `src/dev/*` import-disjoint from `src/server/*` and `src/build/*`, and
  add a CI grep test asserting `src/server/**` never imports `src/dev/**`.
- **Hot-reload race.** `bun --hot` reloads the user's `app/server.ts`;
  if the bundler is owned by the CLI (option C1) it survives the reload
  cleanly. Under C2 the bundler would be re-created on every hot reload
  unless the user guards with `import.meta.hot`. Another reason to prefer
  C1.

## Summary of decisions

- **Axis A: A2′** — eager pre-bundle at startup; on file save mark
  dirty and publish the HMR message; rebuild lazily when the browser
  re-fetches the chunk.
- **Axis B: B1** — on disk under `<appDir>/.patties-dev/client/`. Added
  to the `create-patties` `.gitignore` template.
- **Axis C: C1** — CLI owns the bundler lifecycle; passes the handle in
  via `start({ ..., bundler })`. Field is optional so user-authored
  `server.ts` files written before this spec keep working.
- **Axis D:** prefix `/_patties/client/`, stable filenames,
  `Cache-Control: no-store`.

## Implementation outline (handed off to spec 18)

The follow-up implementation spec covers:

1. New module `src/dev/bundler.ts` exporting `startDevBundler(opts)
   → DevBundlerHandle` with `{ manifest, staticRoutes, markDirty,
   dispose }`. Reuses `src/build/client-entry.ts` for entry generation;
   the only delta is `Bun.build` options (`mode: development`, no minify,
   linked sourcemaps, deterministic non-hashed chunk names).
2. Lazy-rebuild behavior:
   - Internal `dirty: Set<islandName>`.
   - `markDirty(name)` adds to the set; cheap.
   - The static-route handler for `/_patties/client/<name>.js` checks the
     set on each GET. If dirty, runs `Bun.build` for that island,
     atomically swaps the disk artifact, removes the name from the set,
     then serves.
   - Concurrent GETs for the same dirty island coalesce on a single
     in-flight `Bun.build` promise.
3. `src/cli/dev.ts` starts the bundler before importing the user entry,
   passes it in via the new optional `bundler` field on `StartOpts`.
   Stub-server fallback does not get a bundler.
4. `src/dev/watcher.ts` gains an optional `bundler` reference; when a
   change lands under `app/islands/`, it calls `bundler.markDirty(name)`
   (synchronous, no await) and then publishes the existing
   `{ type: "update", island }` WS message.
5. `src/render/dev-error.tsx` gains a "last build error" channel so the
   in-flight build errors from step 2 surface in the browser overlay on
   the next page render.
6. Tests:
   - Unit on `startDevBundler` with a one-island fixture: assert
     startup pre-builds; assert `markDirty` does not rebuild; assert the
     next GET to the chunk URL rebuilds.
   - Extend `tests/integration/dev-hmr.test.ts`: assert the served HTML
     has a `<script src="/_patties/client/…">` that returns 200 with the
     island source.
   - Keep `tests/integration/build.test.ts` green; add a CI grep test
     asserting `src/server/**` never imports `src/dev/**`.

## Decision

**Accepted 2026-05-27.** A2′ + B1 + C1 + D as summarized above.
Implementation lives in `framework/draft/18-dev-island-bundler-impl.md`.

## Future re-evaluation — Bun HTML imports

[[rfc-bun-html-imports]] (deferred, reject-for-v1) proposes replacing
the hand-rolled island bundler with Bun's native HTML-import fullstack
mode. The deferral reasons were "pipeline not yet stable" and "two HMR
systems is confusing." Once spec 18 lands and the dev pipeline has
stabilized, the first reason no longer applies. At that point the
trade-off becomes: a few lines in `src/dev/bundler.ts` vs. running two
HMR systems side-by-side (Bun's HTML-import HMR + our WebSocket HMR).

Trigger to revisit: after spec 18 has been in users' hands for one
release cycle without major bug reports, re-open
`rfc-bun-html-imports` and compare the maintenance cost of
`src/dev/bundler.ts` against the dual-HMR cost. The dev bundler is
designed to be cheap to delete — keep it that way.
