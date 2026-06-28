---
spec: framework/04-build
title: Build
status: done
phase: 1
file: build/index.ts
last_reviewed: 2026-05-24
---

# Spec 04 — Build

## Purpose

Produce the client JavaScript bundle for islands and the deployable server bundle for the configured target. The only bundler is `Bun.build`.

## Public surface

```ts
export interface BuildResult {
  clientManifest: ClientManifest   // island name → public URL
  serverEntry: string              // path to built server entry
  assets: BuiltAsset[]
}

export async function build(options: BuildOptions): Promise<BuildResult>
```

`BuildOptions`:
- `appDir: string`
- `outDir: string` — defaults to `.patties/`.
- `target: "bun" | "edge"` — from [08-config](../phase-2/08-config.md). `"edge"` produces a portable WinterCG / `workerd`-style Worker module; vendor-specific deploy is a plugin concern.
- `mode: "development" | "production"`.

## Behavior

### Client bundle

1. Discover islands by scanning `app/islands/**/*.tsx` (build-time scan — the single source of truth for "what islands exist"; the renderer does not perform runtime detection).
2. Generate a synthetic entry that imports every island and registers it with `createClient()` (see [06](./06-client-islands.md)). The entry always runs `hydrateAll()` on load; when the rendered page has no `data-island` markers, `hydrateAll()` is a no-op.
3. `Bun.build({ entrypoints: [entry], target: "browser", splitting: true, minify: mode === "production", outdir: outDir + "/client" })`.
4. Build the `ClientManifest`: `{ entry: "/_patties/client/<hashed>.js", islands: { [name]: "/_patties/client/<chunk>.js" } }`. The `entry` URL is what `<script type="module">` references; per-island chunks are emitted by `splitting: true` and referenced internally.

### Server bundle

1. Generate a server entry that imports `createServer`, `createRouter`, the user's `app/middleware.ts` if present, and `patties.config.ts`.
2. Inline the build-time route table via a **Bun macro**: the generated server entry contains `import { ROUTES } from "./routes.macro.ts" with { type: "macro" }`. The macro runs `scanRoutes()` at build time and returns a JSON array literal — the bundle ships with the route table baked in, no filesystem scan at runtime. Same trick for `env.public` values: a `patties/config-macro` returns the inlined record.
3. `Bun.build({ entrypoints: [serverEntry], target: targetMap[target], outdir: outDir + "/server" })` where `targetMap` selects `bun` or `browser` (for the `edge` target — Workers/WinterCG conditions).
4. Emit any static assets from `app/public/` into `outDir + "/assets"`.

### Hashing

Asset filenames use **`Bun.CryptoHasher`** (`new Bun.CryptoHasher("xxh64")` — fast, non-cryptographic, stable across platforms; SHA-256 for things that need crypto-grade hashes like SRI). Never compute hashes in JS.

### Single-binary executable (`bun` target only)

When `target: "bun"` and `mode: "production"`, the adapter ([12](../phase-2/12-edge-adapters.md)) can opt into `bun build --compile` to emit a **single standalone executable** that embeds the Bun runtime + bundle. The host machine no longer needs `bun` installed. Triggered by an adapter option (`bun.compile: true`), not by default — compile is slower and the binary is ~50MB.

### Filesystem I/O

All build-time file reads use `Bun.file(path).text() / .json() / .bytes()`; all writes use `Bun.write(path, data)`. Never `node:fs/promises`. This is non-negotiable — see [13-conventions](../13-conventions.md).

### Macro policy

Bun's import attributes (`with { type: "macro" | "text" | "toml" | "json" | "file" | "sqlite" }`) are the framework's preferred way to pull build-time data into bundles. See [[rfc-bun-import-attributes]] for the full policy. Summary:

**Required to be macros** (compiler-enforced "no runtime read" guarantee):
- Route table (`scanRoutes` output) — closes the "no `Bun.Glob` call in production bundle" promise.
- `env.public` values inlined into the client bundle.
- Client manifest (island name → chunk URL).
- AGENTS.md content hash for dev banner cache busting.

**Optional** (may be import-attribute or runtime read; the framework neither requires nor forbids):
- SQL files (`with { type: "text" }` preferred).
- Email/HTML templates (`with { type: "text" }` preferred).
- TOML config blobs (`with { type: "toml" }` preferred when known at build time).
- SQLite seed databases (`with { type: "sqlite" }`).

Macros re-evaluate on `bun --hot` when their input files change (see [05-dev-hmr](./05-dev-hmr.md)). When a macro depends on a file Bun's dep tracker doesn't follow, the macro source explicitly imports that file with `with { type: "file" }` to register the dependency.

## Non-goals

- CSS pipelines beyond what `Bun.build` supports natively.
- Source maps in production (configurable later via RFC).

## Acceptance criteria

- A project with zero islands produces no client bundle and an empty manifest.
- A project with one island produces exactly one chunk in `outDir/client/` referenced by the manifest.
- Building with `target: "edge"` produces a portable `export default { fetch }` module compatible with [12-edge-adapters](../phase-2/12-edge-adapters.md) and any WinterCG / `workerd`-compliant runtime.
- The built server bundle contains the route table as a literal JSON value (verifiable by grepping the output). No call to `Bun.Glob` or `scanRoutes` appears in the production server bundle.
- With `bun.compile: true`, `patties build --target bun` produces a single executable file on disk.
