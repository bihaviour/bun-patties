---
rfc: bun-arraybuffersink
title: Bun.ArrayBufferSink — streaming buffer builder for SSR
status: backlog
verdict: defer
opened: 2026-05-27
reviewed: 2026-05-27
bun_unique: Bun-only
host_subsystem: framework/phase-0/03-render (SSR pipeline — currently uses ReadableStream)
comparable_elsewhere: Node has no equivalent. React's `renderToReadableStream` (what we use today) returns a WHATWG stream. `ArrayBufferSink` is a Bun primitive for assembling binary output with minimal allocation churn.
trigger_to_pickup: SSR profiling shows allocation pressure from many small chunks, OR a streaming HTML compressor wants a tight write loop on top of the renderer.
---

# RFC — Bun.ArrayBufferSink (backlog)

## Summary
`Bun.ArrayBufferSink` lets you accumulate bytes from many writes into a single `ArrayBuffer` or stream them out, with fewer intermediate allocations than `Uint8Array` concatenation.

## Why backlog
Current SSR uses `renderToReadableStream` from React and pipes through to `Response`. No measured benefit yet — we don't have profiling that says the stream path is allocation-bound.

## Trigger to promote to draft
- SSR profiling (e.g. heap snapshots under load) shows the stream → Response path is GC-bound, OR
- An HTML compressor / minifier plugin wants a write-sink it can flush incrementally.

## Bun-unique classification
**Bun-only** — Node has no equivalent streaming buffer builder. `Buffer.concat` is eager; writable streams are higher-level.

## Open questions when promoted
- Does this replace `ReadableStream` end-to-end, or only the inner accumulation buffer behind a stream wrapper?
- Edge adapter (no Bun) needs a fallback path — likely `Uint8Array` concat with a worse allocation profile.
