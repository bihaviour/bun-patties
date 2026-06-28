---
spec: framework/12-edge-adapters
title: Edge Adapters
status: draft
phase: 2
file: adapters/edge.ts, adapters/bun.ts
last_reviewed: 2026-05-23
---

# Spec 12 — Edge Adapters

## Purpose

Translate the framework's built server bundle into a form the target runtime can execute. The framework ships **two built-in adapters** — `bun` and `edge` — and stays vendor-neutral. Anything vendor-specific (wrangler.toml, vercel.json, deno.json, netlify.toml, deploy commands, vendor binding shapes) lives in a **deploy plugin** ([09-plugins](../phase-4/09-plugins.md)), not here.

## Adapter contract

```ts
export interface Adapter {
  name: "edge" | "bun"
  buildTarget: "browser" | "bun"           // passed to Bun.build
  emit(result: BuildResult, ctx: AdapterContext): Promise<EmittedArtifacts>
}
```

Note: no `deploy()` method. Deploying belongs to deploy plugins. Adapters produce portable artifacts; deploy plugins consume them.

## `edge` adapter (default for hosted deployment)

Goal: emit a **portable WinterCG / `workerd`-style Worker module** that runs unmodified on any compliant edge runtime — Cloudflare Workers, Deno Deploy, Vercel Edge, Netlify Edge, Bun's edge runtime, and whatever comes next.

1. Use `Bun.build` with `target: "browser"` and Workers/WinterCG conditions set (no `node:*` core unless polyfilled).
2. The Bun target dispatches via `Bun.serve({ routes })`, which is unavailable on most edge runtimes. The edge adapter compiles the same `RouteEntry[]` (from [02b](../phase-0/02b-filesystem-router.md)) into a small JS matcher (~30 lines): per-segment match, params extraction, method dispatch. Same handlers, same `ctx`, different entrypoint shape. Conformance with the Bun target is enforced by running the integration fixture set against both.
3. Wrap the built server entry in the standard Worker module shape:
   ```ts
   export default {
     async fetch(request: Request, env: Record<string, unknown>, execCtx?: ExecutionContext): Promise<Response> {
       return matcher.dispatch(request, env, execCtx)
     }
   }
   ```
   The `env` argument is the runtime's bindings object — its shape is vendor-specific, but the framework just forwards it to user code via `ctx.env`.
3. Emit `dist/worker.js` and `dist/assets/` (mirror of `app/public/` plus the built `/_patties/client/*` chunks). No `wrangler.toml`, no `vercel.json`, no vendor config of any kind.
4. The artifact is **portable**: the same `dist/worker.js` can be uploaded to multiple hosts. A user with no deploy plugin installed can hand the file to `wrangler deploy`, `vercel deploy --prebuilt`, `deployctl deploy`, etc.
5. Asset serving in production is **the host's job**. The Worker module does not stream static files — it expects the host to route `/_patties/client/*` and `/app/public/*` paths directly to a CDN / static bucket. Deploy plugins emit the vendor-specific config that makes this happen (e.g. Cloudflare Workers Assets block, Vercel `outputDirectory`, Netlify `[[redirects]]`, Deno Deploy static-file routing).
6. **Fallback**: when no deploy plugin is installed, the Worker's catch-all `fetch` handler streams files from the bundled assets directory using a small ~20-line static reader (path normalize → check map → return `new Response(file, { headers })`). Functional but inefficient — deploy plugins disable it in favor of the host's native asset path.

## `bun` adapter (self-hosted / long-running)

- Emit a `dist/server.js` runnable via `bun dist/server.js`.
- **Static serving uses `Bun.serve`'s native `static` route map** — the adapter pre-builds `Response` objects for every file in `./app/public` and `./.patties/client` (`new Response(Bun.file(path), { headers: { ... } })`) and passes them as `staticRoutes` to `createServer` ([01](../phase-0/01-server.md)). Matched paths never enter JS. The catch-all `fetch` handler streams files from disk only as a fallback for paths added at runtime; the static map handles everything known at build time.
- **Unix sockets** and **`reusePort`** are first-class options: `patties.config.ts` `server: { unix: "/tmp/patties.sock" }` or `server: { reusePort: true }` plumb straight to `Bun.serve`. Behind nginx, the unix-socket path avoids the loopback hop; with `reusePort` you can run N copies for N cores.
- **Single-binary executable** (opt-in): set `adapter.bun.compile: true` in `patties.config.ts`. The adapter invokes `bun build --compile --target=bun-${platform} --outfile=dist/server` to embed the runtime + bundle. The host machine no longer needs `bun` installed. The binary is ~50MB and takes longer to produce; off by default.
- No deploy step in the adapter; document `bun run dist/server.js` (or `./dist/server` when compiled) as the run command. A deploy plugin (e.g. `@patties/deploy-bun`) may add Dockerfile / systemd / fly.io packaging if the user wants it.
- Node is **not** a supported target — Bun runs everywhere Node does, and supporting Node would require polyfilling `Bun.serve`, `Bun.Glob`, `Bun.build`, and `--watch`, which contradicts the Bun-native pillar.

## Static assets across targets

| Phase | `bun` target | `edge` target |
|---|---|---|
| Dev (`patties dev`) | `Bun.serve({ static })` map populated with `./app/public/*` and `./.patties/client/*` responses | Same as `bun` — the dev server is always Bun-hosted, regardless of build target |
| Built artifact | `Bun.serve({ static })` map; the catch-all `fetch` handler streams files from disk only as a fallback for paths added at runtime | Host serves `dist/assets/` directly; in-process catch-all streaming is the fallback when no deploy plugin reconfigures it |

This means **dev parity** is held against the `bun` adapter's behavior. Edge-host idiosyncrasies (cache headers, byte-range support, etc.) show up only after a deploy plugin is involved.

## Deploy plugin contract (reference)

Deploy plugins are normal plugins ([09](../phase-4/09-plugins.md)) that hook into the build lifecycle:

```ts
definePlugin({
  name: "deploy-<vendor>",
  setup() {},                              // no runtime route mounts
  hooks: {
    onBuildEnd(result) {
      // 1. Read result.serverEntry
      // 2. Write vendor-specific config (wrangler.toml / vercel.json / etc.) into result.outDir
      // 3. Optionally rewrite the worker entry to use vendor bindings
    },
  },
  // Plugins may register CLI commands (RFC pending): `patties deploy` dispatches to the
  // first deploy plugin whose `target` matches config.target, or errors if none is present.
})
```

The framework does not bundle deploy plugins. Users install the one matching their host. Documentation will list community / official deploy plugins; none are blessed as "the reference."

## Acceptance criteria

- `patties build --target edge` produces a `dist/worker.js` whose `export default { fetch }` runs on any WinterCG-compliant runtime without modification.
- `patties build --target edge` succeeds with zero deploy plugins installed; the artifact is usable, just without vendor-specific config files.
- Installing `@patties/deploy-cloudflare` and rebuilding adds `dist/wrangler.toml` and the Workers Assets config without changing the worker entry's behavior.
- The same `dist/worker.js` produced by `patties build --target edge` can be deployed to two different hosts (e.g. Cloudflare + Vercel Edge) using only their respective deploy plugins — no source changes.
- `patties build --target bun` produces a single executable JS file runnable with `bun`.
- `patties build --target node` is rejected at config-validation time with a message naming the allowed targets (`bun`, `edge`).
