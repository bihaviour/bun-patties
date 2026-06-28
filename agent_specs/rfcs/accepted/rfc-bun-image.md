---
rfc: bun-image
title: Bun.Image — in-process image transforms for static assets
status: encoded
encoded_in: ["framework/draft/22-image-pipeline"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: 2
affects_specs: [04-build, 12-edge-adapters, 22-image-pipeline]
bun_unique: Bun-builtin
host_subsystem: framework/draft/22-image-pipeline (image-variant pipeline + signed runtime endpoint + disk LRU cache)
comparable_elsewhere: `next/image` (Sharp native addon, 30+ MB install); Astro `<Image>` (Sharp); Remix Image; Vercel Image Optimization (CDN-side).
---

## Review verdict (2026-05-27)

**Accept.** Image optimization is one of `next/image`'s most-loved
features and a recurring user expectation — patties should ship it
on day one. Sharp (Node's image lib of record) is a 30+ MB native
addon that complicates Docker images, breaks cross-platform builds,
and adds material cold-start cost. Bun ships image decode/encode in
core; we ship the same `<Image>` ergonomics with zero install
footprint and faster boot.

This is the cleanest expression of the project's reframed value
proposition: **patties' edge isn't "things Next on Node can't do"
— it's "things every Node framework does, but with a fraction of
the dependency surface."**

Scope pins (per the maximally-ambitious option chosen on 2026-05-27):
- **`<Image>` React component** as the user-facing API.
- **Build-time pre-generation** for static assets in `app/public/`.
- **Runtime endpoint** at `/_patties/image` for on-demand transforms
  of unknown sources.
- **Signed URL params** (HMAC-SHA256) to defend against
  cache-stampede / disk-fill attacks.
- **On-disk LRU cache** at `.patties/image-cache/`, size-limited
  + atime-based eviction.
- **Edge adapter:** build-time variants only; runtime endpoint
  disabled (WinterCG runtimes don't have writable disk).

Out of scope for this RFC:
- **Vendor CDN integration** (Cloudflare Image Resizing, Vercel
  Image Optimization) — belongs in deploy plugins.
- **GIF / animated formats** — Bun.Image's animation story not
  landed.
- **SVG transforms** — served as-is.
- **CSS image refs** — `<img>` only.

---

# RFC — Bun.Image → next/image-class pipeline

## Summary

`Bun.Image` performs decode / resize / re-encode in-process without
a native addon. Combined with a React `<Image>` component, a
build-time variant generator, and a signed runtime endpoint, it
gives patties users `next/image` ergonomics with the Sharp dep tax
removed.

## Motivation

Image optimization is table-stakes for a meta-framework in 2026.
`next/image` defines what users expect:

- Responsive srcsets (AVIF / WebP / JPEG)
- Lazy loading by default
- Build-time pre-generation for known images
- On-demand resize for user-uploaded URLs
- Cache layer between user and image source

Today, patties users serve images as opaque static files. They
either lose the ergonomics or install Sharp + write the pipeline
themselves. With Bun.Image in core, the framework can ship the
pipeline at near-zero cost.

## Proposal

See [[framework/draft/22-image-pipeline|spec 22]] for the full
shape. Summary:

- **`<Image>`** React component that renders `<img srcset>`.
- **Build pass** that walks `app/public/**/*.{png,jpg,jpeg,webp,avif}`,
  generates AVIF/WebP/JPEG variants at configured widths via
  `Bun.Image`, emits a manifest inlined into the server bundle via
  Bun macros.
- **Runtime endpoint** at `/_patties/image?src=...&w=...&fmt=...&q=...&sig=...`
  for sources not in the manifest. HMAC-signed URLs only.
- **Disk LRU cache** at `.patties/image-cache/`; size-limited with
  atime-based eviction.
- **Configuration knobs** under `images.*` in `patties.config.ts`:
  domains, formats, widths, qualities, cacheDir, cacheMaxBytes,
  signingSecret.

## Trade-offs

- **API surface is large.** Many config knobs, a signed URL flow,
  a React component, a disk cache. Mitigation: defaults are
  production-grade out of the box; users opt into knobs only when
  needed.
- **Disk cache requires writable filesystem.** Edge adapters
  disable the runtime endpoint; that's the right call but means
  feature parity is bun-target-only.
- **HMAC signing requires a secret.** First-run derives one from
  `(projectName, buildHash)` with a one-time warning; users add a
  real secret before deploying. Same pattern as
  `Bun.randomUUIDv7`'s fallback shape.
- **Sharp parity not guaranteed.** Bun.Image's feature surface may
  lag Sharp (e.g. exotic color space conversions, smartcrop). We
  ship what Bun supports; edge cases fall back to deploy-plugin
  CDN integration.

## Open questions

- **Cache eviction policy** — LRU by atime is the v1 choice. LFU
  or size-weighted are alternatives; revisit if eviction storms
  show up in profiling.
- **Allowed external domains** — `images.domains` allowlist is
  v1; a future RFC could add per-domain rewriting (replace user
  URLs with vendor CDN URLs at render time).
- **Quality presets** — config exposes `qualities: [50, 75, 90]`
  but the component takes a free-form `quality` prop clamped to
  the allowlist. Users may expect any 1–100 value; revisit if
  this is friction.
