---
rfc: bun-alt-compression
title: Bun.deflateSync / Bun.zstdCompress — alternate asset compression
status: backlog
verdict: defer
opened: 2026-05-27
reviewed: 2026-05-27
bun_unique: Bun-only for zstd; Standard for deflate
host_subsystem: cli/archive/03-build-command (build asset compression — currently gzip only via `Bun.gzipSync`)
comparable_elsewhere: Next pre-compresses with gzip and brotli (`next build` writes `.gz` and `.br`). Vercel CDN serves brotli where supported. Cloudflare serves brotli + zstd. Node 22+ has `zlib.zstdCompress` (very recent); older Node uses native addons.
trigger_to_pickup: Build output needs brotli (`.br`) for static assets on CDNs that prefer it, OR Cloudflare adapter wants zstd-compressed assets for the smaller payload.
---

# RFC — Bun.deflateSync / zstdCompress (backlog)

## Summary
`Bun.deflateSync` (raw deflate / zlib), `Bun.zstdCompress*` (zstd, sync + streaming). Adds alternate algorithms to the build's asset pre-compression step. Note: brotli compression (`Bun.brotliCompress*`) lives next to these and is usually the higher-impact addition.

## Why backlog
`Bun.gzipSync` already covers the common case (CDNs accept gzip universally). Brotli is the more useful win than zstd; deflate is rarely needed. No urgent reason to ship.

## Trigger to promote to draft
- Cloudflare / Bun edge adapter benchmarks show meaningful size/latency wins from brotli/zstd, OR
- A user-facing config flag for "compression formats" is requested.

## Bun-unique classification
**Bun-only** for zstd (Node only got it in 22+ and it's still recent); **Standard** for deflate. Brotli is standard on both runtimes.

## Open questions when promoted
- Which algorithms do we actually ship — gzip + brotli (probable), or also zstd?
- Build-time pre-compression (current model) vs on-the-fly response compression — they're different concerns.
- Per-file extension policy (skip already-compressed `.png`/`.jpg`/`.woff2`).
