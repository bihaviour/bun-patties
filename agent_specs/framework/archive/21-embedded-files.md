---
spec: framework/21-embedded-files
title: Embedded files — single-binary deploy with embedded static assets
status: completed
phase: 2
file: src/build/, src/adapters/bun/
last_reviewed: 2026-05-30
supersedes: framework/archive/phase-1/04-build (extends — adds asset-embedding step when adapter.bun.compile is true), framework/archive/phase-2/12-edge-adapters (extends — single-binary deploy now ships a truly single file with no separate dist/assets/)
rfc: rfc-bun-embedded-files
---

# Spec 21 — Embedded files

This spec encodes [[rfc-bun-embedded-files]]. It extends the build
pipeline ([[framework/archive/phase-1/04-build|spec 04]]) and the bun
adapter ([[framework/archive/phase-2/12-edge-adapters|spec 12]]) so
that `patties build --target bun` with `adapter.bun.compile: true`
produces a **truly single file** — runtime, server bundle, and all
static assets in one binary.

`Bun.embeddedFiles` is the runtime-side API that exposes files
embedded into a `--compile`'d binary as `BunFile[]`. The build side
uses Bun's existing `with { type: "file" }` import attributes to
register files for embedding.

## Goal

Today, `patties build --target bun` with `compile: true` produces:

```
dist/
  server        # compiled binary (~50MB)
  assets/
    favicon.ico
    logo.png
    _patties/client/<hash>.js
    ...
```

The user must ship the binary **and** the `dist/assets/` directory.
That's not a single-file deploy — it's a binary with a sidecar.

With this spec:

```
dist/
  server        # binary contains runtime + bundle + assets
```

`scp dist/server user@host:/srv/`. Done.

## Surface

No new user-facing API. Behavior changes only when
`adapter.bun.compile` is `true`.

The existing `adapter.bun.compile` boolean now also gates asset
embedding — if compile is on, assets are embedded; if compile is
off, assets remain in `dist/assets/` as today.

## Build behaviour

### Asset-embedding entry

When `adapter.bun.compile === true` and `mode === "production"`, the
build (`src/build/index.ts`) generates an additional synthetic
module that imports every static asset:

```ts
// .patties/embedded-manifest.ts (generated at build time)
import favicon from "../app/public/favicon.ico" with { type: "file" }
import logo from "../app/public/logo.png" with { type: "file" }
import clientEntry from "../.patties/client/abc123.js" with { type: "file" }
// ...one import per file in app/public + .patties/client

export const EMBEDDED_ASSET_PATHS: Record<string, string> = {
  "/favicon.ico": favicon,
  "/logo.png": logo,
  "/_patties/client/abc123.js": clientEntry,
}
```

The build walks `app/public/**/*` and `.patties/client/**/*` (the
built client chunks) and emits one `import ... with { type: "file" }`
per file. The synthetic module is imported from the server entry so
Bun's bundler picks up the file dependencies and emits them into the
binary at `--compile` time.

### Compile invocation

The bun adapter (`src/adapters/bun/`) calls:

```ts
Bun.spawnSync([
  "bun", "build", "--compile",
  `--target=bun-${platform}`,
  "--outfile=dist/server",
  serverEntry,
])
```

This is unchanged from today. The new piece is that `serverEntry`
now transitively imports the embedded-manifest module, so all
listed files are bundled into the binary's embedded-files table.

### Assets directory output

When `compile === true`, the adapter does **not** emit
`dist/assets/`. The directory is redundant — every file is already
inside the binary.

When `compile === false` (default), behaviour is unchanged:
`dist/assets/` is emitted and served via the catch-all fetch
handler as today.

## Runtime behaviour

### Static map construction (compile mode)

In compile mode, the bun adapter's static map is built from
`Bun.embeddedFiles` instead of disk paths:

```ts
import { EMBEDDED_ASSET_PATHS } from "./embedded-manifest"

const filesByName = new Map<string, BunFile>()
for (const file of Bun.embeddedFiles) {
  filesByName.set(file.name, file)
}

const staticMap: Record<string, Response> = {}
for (const [route, fileId] of Object.entries(EMBEDDED_ASSET_PATHS)) {
  const file = filesByName.get(fileId)
  if (file) {
    staticMap[route] = new Response(file, {
      headers: { "content-type": file.type },
    })
  }
}
```

The resulting `staticMap` plugs into `Bun.serve`'s `static` option
the same way `app/public/` files do in non-compile mode. Matched
paths never enter JS.

### Filesystem reads at runtime

The compiled binary **must not** read assets from disk. The
catch-all fetch handler's filesystem-streaming fallback (spec 12,
"Static assets across targets") is disabled when `compile === true`
— a missing asset returns 404 directly, not "try disk first."

This is the cleanest expression of the build-time-discovery rule:
the binary contains everything it needs; the filesystem could be
empty and the server would still respond correctly.

### Dev mode

Dev mode (`patties dev`) is unchanged. The dev server reads
`app/public/` from disk via `Bun.file(path)` per the existing dev
spec. Embedded files are a build-time / production-only feature.

## Build-time discovery

Per the build-time discovery rule, the route table is already
inlined via Bun macro (spec 04 § "Server bundle"). This spec
extends the same discipline to static assets: the asset list is
walked at build time, embedded at compile time, looked up at
runtime — no `Bun.Glob` of `app/public` in the production binary.

## Edge adapter

Out of scope for this spec. The edge adapter targets WinterCG /
`workerd` runtimes that don't use `bun build --compile`, so
`Bun.embeddedFiles` doesn't apply there. Edge static-asset delivery
remains "the host's job" per spec 12. A future RFC may explore
file embedding for non-compile builds, but that's not this spec.

## Non-goals

- **Edge adapter parity.** Edge builds still emit `dist/assets/`.
- **Asset hashing changes.** Spec 04's `Bun.CryptoHasher` flow
  already hashes asset filenames; embedded paths use the hashed
  names.
- **Compile-mode-by-default.** Compile remains opt-in via
  `adapter.bun.compile: true`. The default
  `patties build --target bun` still emits the JS server bundle +
  assets directory.
- **Dynamic asset addition.** Assets known to the build are
  embedded; assets added at runtime (rare) still need disk and are
  out of scope for compile mode — users adding runtime assets
  should leave compile off.
- **Compression.** The binary stores assets as-is; build-time
  brotli/zstd variants are a separate concern
  (see [[rfc-bun-alt-compression]]).

## Acceptance criteria

- `patties build --target bun` with `adapter.bun.compile: true`
  produces a single executable at `dist/server` and **no**
  `dist/assets/` directory.
- The same compiled binary, moved to a directory with no
  `dist/assets/` present, serves all files from `app/public/`
  and the client bundle correctly.
- `Bun.embeddedFiles` returns the full list of embedded assets at
  runtime; the static map covers every embedded path.
- `patties build --target bun` with `compile: false` (default)
  still emits `dist/assets/` and the JS server bundle, unchanged
  from today.
- `patties build --target edge` is unaffected by this spec.
- The catch-all fetch handler in compile mode does not attempt to
  read from `process.cwd()/app/public` — verifiable by stubbing
  `Bun.file` to throw and confirming the binary still serves
  embedded assets.

## Test plan

- Unit: build a fixture with `app/public/{a.txt,b.png}` →
  inspect generated `.patties/embedded-manifest.ts` → assert two
  `with { type: "file" }` imports.
- Integration: `patties build --target bun` with `compile: true`
  on a fixture with assets → run the resulting binary in an empty
  directory → curl each asset path → expect 200 with correct
  bytes.
- Integration: same fixture, `compile: false` → assert
  `dist/assets/` exists and binary path does not.
- Integration: stub the filesystem so disk reads fail → compiled
  binary still serves embedded assets correctly.
- Negative: `--target edge` with `compile: true` is a config-time
  error (compile is bun-only).

## Out of this spec

- The deploy plugin contract (spec 12 § "Deploy plugin contract")
  is unaffected — plugins still emit vendor configs. Deploy
  plugins that consume the compiled binary should treat it as a
  drop-in replacement for `dist/server` + `dist/assets/`.
- The `--smol` flag ([[rfc-bun-smol]]) is orthogonal; it tunes
  the allocator, not asset embedding.
