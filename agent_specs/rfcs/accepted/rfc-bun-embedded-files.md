---
rfc: bun-embedded-files
title: Bun.embeddedFiles — single-binary deploy with embedded static assets
status: encoded
encoded_in: ["framework/archive/21-embedded-files"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: 2
affects_specs: [04-build, 12-edge-adapters, 21-embedded-files]
bun_unique: Bun-only
host_subsystem: framework/archive/phase-2/12-edge-adapters (bun adapter compile path) + framework/archive/phase-1/04-build (asset embedding step)
comparable_elsewhere: None — this is a genuine Bun unlock. Node has experimental SEA (Single Executable Apps) but it's awkward, not bundler-integrated, and rarely shipped to production. Next.js / Remix / SvelteKit have no single-binary deploy. Deno has `deno compile` but no equivalent embedded-file API for build-time discovery output.
---

## Review verdict (2026-05-27)

**Accept.** This is the only acceptance in the bucket-A pass that
demonstrates a *structural* Bun advantage — not a dep-replacement,
not an ergonomics win, but a deploy story no Next-on-Node framework
can ship today. The user gets a truly single-file binary: `scp dist/server` and done. No sidecar `dist/assets/` directory, no
separate static-file CDN bootstrap. The build-time-discovery rule
extends from routes (already inlined via macros) to assets
(embedded via `with { type: "file" }` + `Bun.embeddedFiles`).

Scope pins:
- **Bun adapter `--compile` path only.** Edge adapter is out of
  scope — Workers / WinterCG runtimes don't use `bun --compile`.
- **Opt-in.** Compile remains gated by `adapter.bun.compile: true`.
  Default builds still emit JS server bundle + `dist/assets/`.
- **Production only.** Dev mode reads `app/public/` from disk.
- **Disable disk fallback in compile mode.** The catch-all fetch
  handler must not try disk if an asset is missing — return 404.
  Cleanest expression of "the binary contains everything."

Out of scope for this RFC:
- **Edge adapter parity.** Separate concern; revisit when a
  non-compile file-embedding pattern matters.
- **Compile-by-default.** Bigger UX decision; this RFC just makes
  compile-mode actually single-file.
- **Compression of embedded assets.** See
  [[rfc-bun-alt-compression]] for build-time brotli/zstd.

---

# RFC — Bun.embeddedFiles → single-binary deploy

## Summary

`Bun.embeddedFiles` exposes files embedded into a `--compile`'d
binary as `BunFile[]`. Combined with Bun's
`with { type: "file" }` import attribute (build side), it lets a
single executable contain not just runtime + JS bundle but also all
static assets — the user ships one file, not a binary + assets
directory.

## Motivation

Today, the bun adapter's compile mode produces:

```
dist/
  server        # ~50MB binary
  assets/       # static files separately
```

Users who want the "scp one file, done" story are blocked by the
sidecar directory. The fix is straightforward on Bun: walk assets at
build time, register each via `import ... with { type: "file" }`,
and look them up at runtime via `Bun.embeddedFiles`. The same trick
the route table already uses (build-time inlining via macros)
applies to assets.

This is the cleanest expression of the build-time discovery rule:
the filesystem could be empty and the server still works.

## Proposal

### Build (`src/build/`)

When `adapter.bun.compile === true` and `mode === "production"`,
emit a generated module `.patties/embedded-manifest.ts` containing
one `import ... with { type: "file" }` per asset in `app/public/`
and `.patties/client/`. Import that module from the server entry so
Bun's bundler picks up the dependencies and embeds them at compile
time.

### Adapter (`src/adapters/bun/`)

In compile mode, build the static map by iterating
`Bun.embeddedFiles` and mapping each to a `Response` via the
manifest. Pass the static map to `Bun.serve({ static })` as today.

Disable the catch-all fetch handler's disk-streaming fallback in
compile mode — assets not in the embedded set return 404 directly.

### Output layout

```
dist/
  server        # single executable, contains everything
```

No `dist/assets/`.

## Trade-offs

- **Binary grows by the asset payload size.** Acceptable — the
  user explicitly opted into `compile: true`. If they have a 1GB
  video in `app/public/`, they get a 1GB binary. Document this.
- **No partial updates.** Today, swapping out `dist/assets/logo.png`
  doesn't require a rebuild. With embedded assets, it does. Same
  trade-off as compile-mode itself.
- **Edge adapter doesn't benefit.** Workers / WinterCG runtimes
  don't have `bun --compile`, so the embedded-files API has no
  effect there. The win is bun-target-specific.

## Open questions

- **File-content embedding vs metadata-only embedding** — decision
  for v1: full content (this is the point of `Bun.embeddedFiles`;
  metadata-only would defeat single-file-deploy).
- **Build-time hashing for cache busting** — already handled by
  spec 04's `Bun.CryptoHasher` flow; embedded paths use the same
  hashed names as on-disk assets.
- **Dev-mode equivalent** — dev re-scans the filesystem (per the
  build-time-discovery rule's dev exception); `embeddedFiles` is
  prod-compile-only.
