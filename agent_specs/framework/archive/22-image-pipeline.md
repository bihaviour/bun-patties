---
spec: framework/22-image-pipeline
title: Image pipeline — build-time variants + runtime endpoint + signed cache
status: accepted (implementation pending)
phase: 2
file: src/build/, src/render/, src/server/, src/adapters/{bun,edge}/, src/client/
last_reviewed: 2026-05-27
supersedes: framework/archive/phase-1/04-build (extends — adds image-variant generation step), framework/archive/phase-2/12-edge-adapters (extends — adds /_patties/image endpoint)
rfc: rfc-bun-image
---

# Spec 22 — Image pipeline

This spec encodes [[rfc-bun-image]]. It introduces a `next/image`-class
image pipeline built on Bun.Image: build-time variant generation for
known assets, a `<Image>` React component, a signed runtime endpoint
for on-demand transforms, and an on-disk LRU cache shared between
both paths.

The patties value: **same capability `next/image` ships, without
the 30+MB Sharp native addon.** Bun ships image decode/encode in
core.

## Goal

`<Image>` is the boring default for serving images. It produces
responsive AVIF/WebP/JPEG srcsets, lazy-loads by default, and works
without a config file. Static assets get pre-generated variants at
build time; user-uploaded or dynamic URLs go through a signed
runtime endpoint that resizes on demand and caches to disk.

## Surface

### `<Image>` component

```tsx
import { Image } from "patties/render"

<Image
  src="/photo.jpg"           // static asset path OR external URL
  alt="Cat in a box"
  width={800}                // intrinsic
  height={600}               // intrinsic
  sizes="(max-width: 768px) 100vw, 50vw"
  priority={false}           // skip lazy-load
  quality={80}               // 1–100; default 75
  formats={["avif", "webp"]} // optional; default platform-tuned
/>
```

Renders to:

```html
<img
  src="/_patties/images/photo.<hash>.640.jpeg"
  srcset="...320.avif 320w, ...640.avif 640w, ...1280.avif 1280w"
  sizes="..."
  loading="lazy"
  decoding="async"
  width="800" height="600"
  alt="Cat in a box"
/>
```

For static assets known to the build, all URLs in the srcset point
to pre-generated files in `.patties/images/`. For unknown URLs (e.g.
a user-uploaded path like `/uploads/123.jpg`), srcset URLs point at
the signed runtime endpoint.

### Runtime endpoint

```
GET /_patties/image?src=<path>&w=<width>&fmt=<format>&q=<quality>&sig=<hmac>
```

- `src` — URL-encoded path. Allowed sources: project-relative paths
  (`/uploads/...`), trusted external origins (configured allowlist),
  or build-known paths.
- `w` — target width.
- `fmt` — output format (`avif` / `webp` / `jpeg` / `png`).
- `q` — quality (1–100; clamped).
- `sig` — base64url HMAC-SHA256 of `${src}|${w}|${fmt}|${q}` using
  the configured signing secret.

Unsigned or bad-signature requests return 400 immediately. This
defends against the cache-stampede / disk-fill attack vector where a
caller enumerates a billion (src, w) combos to exhaust the cache.

## Configuration

```ts
// patties.config.ts
export default defineConfig({
  images: {
    domains: ["cdn.example.com"],     // external origin allowlist
    formats: ["avif", "webp"],         // preferred output formats
    qualities: [50, 75, 90],           // allowed q values
    widths: [320, 640, 1280, 2560],    // srcset breakpoints
    cacheDir: ".patties/image-cache",  // disk cache location
    cacheMaxBytes: 1024 * 1024 * 1024, // 1 GiB default
    signingSecret: undefined,          // resolved from Bun.secrets → env → here
  },
})
```

All fields optional; defaults shown.

## Build behaviour

### Scan + pre-generate

When `mode === "production"` (or always-on in dev — see Dev mode
below), the build (`src/build/images.ts`) walks
`app/public/**/*.{png,jpg,jpeg,webp,avif}`. For each image:

1. Decode via `Bun.Image.from(file)` to get intrinsic dimensions.
2. For each `(width, format)` pair from config, encode a variant.
3. Hash the source bytes via `Bun.CryptoHasher("xxh64")`.
4. Write to `.patties/images/<basename>.<hash>.<w>.<fmt>`.
5. Record in `IMAGE_MANIFEST`.

```ts
// .patties/image-manifest.ts (generated, inlined via macro per spec 04)
export const IMAGE_MANIFEST: Record<string, ImageManifestEntry> = {
  "/photo.jpg": {
    intrinsic: { width: 2560, height: 1920 },
    variants: [
      { w: 320,  fmt: "avif", url: "/_patties/images/photo.abc123.320.avif"  },
      { w: 640,  fmt: "avif", url: "/_patties/images/photo.abc123.640.avif"  },
      // ...
    ],
    contentType: "image/jpeg",
  },
}
```

### Manifest inlining

`IMAGE_MANIFEST` rides the existing Bun-macro pattern (spec 04 §
Server bundle): the server entry imports it `with { type: "macro" }`
so the manifest is inlined into the production bundle. No
runtime `Bun.Glob` of `.patties/images/`.

## Runtime behaviour

### `<Image>` render

For a `src` present in `IMAGE_MANIFEST`, render `<img srcset>`
pointing at the pre-generated variants. The `src` attribute is the
mid-range JPEG fallback for browsers that don't support srcset.

For a `src` *not* in the manifest:

- If the path is project-relative or matches `images.domains`,
  render `<img srcset>` pointing at the signed runtime endpoint
  (one URL per width × preferred format).
- Otherwise, fail at build time (typecheck) with a clear error.

### Endpoint flow

```ts
// src/server/image-endpoint.ts
async function serveImage(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const params = parseImageParams(url.searchParams)
  if (!verifyHmac(params, getSigningSecret())) return new Response(null, { status: 400 })

  const cacheKey = `${params.src}|${params.w}|${params.fmt}|${params.q}`
  const cachePath = `${config.images.cacheDir}/${hashCacheKey(cacheKey)}.${params.fmt}`

  const cached = Bun.file(cachePath)
  if (await cached.exists()) {
    touchAtime(cachePath)             // for LRU
    return new Response(cached, headers(params.fmt))
  }

  const sourceBytes = await resolveSource(params.src)
  const transformed = await Bun.Image.from(sourceBytes)
    .resize({ width: params.w })
    .encode(params.fmt, { quality: params.q })

  await Bun.write(cachePath, transformed)
  await maybeEvict(config.images.cacheDir, config.images.cacheMaxBytes)
  return new Response(transformed, headers(params.fmt))
}
```

The endpoint is mounted at `/_patties/image` by the framework — it's
a framework route, not user middleware.

### Cache eviction

`maybeEvict` is called after every cache write. Implementation:

1. Tally cache-dir size (cheap on Bun via `Bun.file(...).size`).
2. If over `cacheMaxBytes`, list files sorted by `atime` ascending,
   delete oldest until under the limit minus a 10% margin.

This is a basic disk-LRU. Workers / edge deploys (which don't have
a writable filesystem) disable the runtime endpoint entirely — see
Adapter behaviour below.

## Signing secret

Source precedence (first non-empty wins):

1. `Bun.secrets.get("patties.images.signing")` (Bun adapter only).
2. `process.env.PATTIES_IMAGE_SIGNING_SECRET`.
3. `images.signingSecret` in `patties.config.ts`.

If none found, the framework derives one at boot from a hash of
`(projectName, buildHash)` and warns once per process. This keeps
dev frictionless but makes the warning visible enough that users
add a real secret before deploying.

Secret rotation: an array `signingSecrets: [current, ...old]` accepts
all values for verify and uses index 0 for signing. Same pattern as
[[rfc-bun-cookie-signing]] proposes for cookies (deferred).

## Adapter behaviour

### `bun` adapter

Full support: build-time variants + runtime endpoint + disk cache.
The endpoint mounts on `Bun.serve` alongside framework routes.

### `edge` adapter

Build-time variants only. The runtime endpoint is **disabled** —
WinterCG runtimes can't reliably write to disk, and per-request
image transform on a CPU-limited Worker is the wrong shape. The
edge adapter falls back to "all srcset URLs must be in the manifest"
— if `<Image>` is asked to render a non-manifest src, it logs a
warning and renders the source `src` directly.

Deploy plugins for vendor image CDNs (Cloudflare Image Resizing,
Vercel Image Optimization) can override this by registering an
`image-url` hook that rewrites srcset URLs to vendor endpoints —
spec'd as part of the deploy-plugin contract in
[[framework/archive/phase-2/12-edge-adapters|spec 12]].

## Dev mode

- Build-time variants run during `patties dev` boot and on file
  change (via `bun --watch` triggering the build).
- Runtime endpoint is enabled with a dev-only signing secret
  derived from a stable hash of the project path — no env var
  needed for first-run.
- Cache writes happen in `.patties/image-cache/` exactly as in
  prod, so refreshes are fast after the first render.

## Non-goals

- **Vendor CDN integration.** Cloudflare Image Resizing / Vercel
  Image Optimization belong in deploy plugins, not core.
- **GIF / animated image support.** Bun.Image's animation story is
  not landed; out of scope until it is.
- **SVG transforms.** SVG is rendered as-is via `<img src>`; no
  resize / encode pipeline. Use raster sources for srcsets.
- **Background-image / CSS pipeline.** This spec only covers
  `<img>` tags. CSS image refs are unchanged.
- **`fill` / `intrinsic` layout modes.** v1 ships `width` +
  `height` (intrinsic), no layout-mode prop. Add later if needed.

## Acceptance criteria

- A project with `app/public/photo.jpg` and `<Image src="/photo.jpg" />`
  produces a build that emits AVIF + WebP + JPEG variants at the
  configured widths into `.patties/images/`.
- The rendered `<img>` has a `srcset` with all variant URLs and
  `loading="lazy"` (unless `priority`).
- `GET /_patties/image?src=/uploads/x.jpg&w=640&fmt=webp&sig=<correct>`
  returns a 640px WebP variant cached at
  `.patties/image-cache/<hash>.webp`.
- Same request with a bad `sig` returns 400.
- Cache grows up to `cacheMaxBytes` then evicts oldest by atime.
- On the edge adapter, the runtime endpoint route returns 404 and
  `<Image>` for an unknown src renders the source URL directly with
  a console warning in dev.

## Test plan

- Unit: `IMAGE_MANIFEST` generation for a fixture with one image →
  assert N variants written + manifest entry shape.
- Unit: `signImageUrl` + `verifyImageUrl` round-trip; bad sig
  rejected.
- Unit: cache eviction — fill past limit, assert oldest files
  removed.
- Integration: `<Image>` SSR with manifest-known src → assert
  expected srcset shape.
- Integration: `<Image>` SSR with unknown src → assert signed
  endpoint URLs in srcset.
- Integration: `GET /_patties/image?...` correct flow → 200 +
  cached file on disk.
- Adapter: edge build → endpoint absent + warning path verified.

## Out of this spec

- Image upload handling (multipart form, S3 put, etc.) — separate
  concern.
- Sharp removal from the docs site or example apps — content task.
- Deploy-plugin image-url hook contract — covered in spec 12.
