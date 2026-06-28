---
spec: framework/02b-filesystem-router
title: Filesystem Router
status: completed
phase: 0
file: router/filesystem.ts
last_reviewed: 2026-05-23
---

# Spec 02b — Filesystem Router

## Purpose

Scan `app/routes/` with `Bun.Glob` and produce a sorted, deterministic list of `RouteEntry` records consumed by [02-router](./02-router.md).

## Public surface

```ts
export interface RouteEntry {
  filePath: string         // absolute path
  bunPattern: string       // Bun.serve({ routes }) pattern, e.g. "/hotels/:city" or "/files/*"
  kind: "page" | "api"
  segments: Segment[]      // parsed form, useful for sorting
}

export async function scanRoutes(appDir: string): Promise<RouteEntry[]>
```

## Behavior

1. Use `new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: appDir + "/routes" })`.
   - If `app/routes/` does not exist (fresh scaffold, no routes yet), return `[]`. The scanner catches the `ENOENT`-style failure from `scan()` and treats a missing routes dir identically to an empty one. Any other glob failure must propagate.
2. Skip files starting with `_` (private) or matching `*.test.ts(x)`.
3. Classify: paths under `routes/api/` are `api`; `.tsx` elsewhere are `page`; `.ts` outside `api/` is an error.
4. Translate to a `Bun.serve({ routes })` pattern:
   - `index` → `""` (joined with parent path).
   - `[name]` → `:name`.
   - `[...name]` → `*` (Bun's catch-all; the matched suffix is exposed via `req.params["*"]`).
5. Sort entries so static segments outrank dynamic, and shorter patterns outrank catch-alls. Determinism matters for HMR diffing.

## Dependencies

- `Bun.Glob` only — no `fast-glob`, no `globby`.
- All file existence/metadata checks use `Bun.file(path).exists()` and `Bun.file(path).size`. Never `node:fs.stat` or `fs.access`.

## Build-time vs runtime

In dev (`patties dev`), `scanRoutes` runs at boot and on `bun --watch` restarts.

In production builds, the scanner runs once at **build time** ([04-build](../phase-1/04-build.md)) and its output is inlined into the server bundle via a Bun macro (`import { ROUTES } from "./routes.macro" with { type: "macro" }`). The runtime server reads `ROUTES` directly — no filesystem scan happens after `Bun.serve` boots. On the `edge` target this eliminates a ~30–80ms cold-start penalty per Worker isolate.

## Non-goals

- Watching the filesystem (that's [05-dev-hmr](../phase-1/05-dev-hmr.md)).
- Loading the modules — scanner returns paths; the router decides when to `import()`.

## Acceptance criteria

- Empty `routes/` returns `[]`.
- Missing `routes/` directory entirely (no `app/routes/` at all) also returns `[]` — no thrown error.
- Two files producing the same pattern raise a clear conflict error naming both paths.
- The output is stable across runs for the same input tree.
