---
spec: framework/00-overview
title: Patties Framework — Overview
status: completed
phase: all
last_reviewed: 2026-05-24
source: patties-oss-guide.docx
---

# Patties Framework — Draft Overview

## Mission

Patties is a Bun-native full-stack meta-framework with React for UI and Bun's own `Bun.serve` for HTTP, in a single `bun dev` command, deployable to the edge without configuration.

## Pillars (non-negotiable)

1. **Bun-native** — use Bun primitives (`Bun.serve`, `Bun.Glob`, `Bun.build`, `bun --hot`). Never reach for Node.js `http`, `chokidar`, `webpack`, or `vite`. No HTTP framework dependency — `Bun.serve({ routes })` is the router.
2. **Standard Web APIs at the boundary** — handlers receive a `Request`, return a `Response`. A thin framework-owned `ctx` carries params, cookies (`Bun.CookieMap`), env, and the AI context.
3. **React for rendering** — server uses `react-dom/server` (`renderToReadableStream`); islands use `react-dom/client` (`hydrateRoot`). Bun runs both natively; we never reach for Node-only React APIs like `renderToPipeableStream`.
4. **Edge-first, vendor-neutral** — the default deploy artifact is a portable WinterCG / `workerd`-style Worker module (`export default { fetch }`). It runs on any compliant edge runtime — Cloudflare Workers, Deno Deploy, Vercel Edge, Netlify Edge, Bun's own edge runtime, etc. The framework picks no vendor; vendor-specific deploy lives in plugins.
5. **AI-native** — agents and MCP tools are first-class directories, not plugins. `AGENTS.md` is generated on every build.

## Non-goals

- Compatibility with the `next` import surface.
- Node.js as a runtime target. Supported targets are `bun` and `edge`.
- Bundling vendor-specific deploy config (wrangler.toml, vercel.json, deno.json, netlify.toml) into the framework core. Those live in deploy plugins so we never become a Cloudflare-only — or any-single-vendor — framework.
- A custom bundler — `Bun.build` is the only bundler.
- A custom file watcher — `bun --watch` is the only watcher.

## Package layout

Patties ships as a single npm package (`patties`) with subpath exports:

- `patties` — `createServer`, `createRouter`, `createRenderer`, core types.
- `patties/config` — `defineConfig`, config schema.
- `patties/ai` — `defineAgent`, `defineTool`, `getAgent`, `getTool`, `streamText`, `streamObject`, `createAiContext`.
- `patties/client` — `createClient`, hydration runtime.
- `patties/plugin` — `definePlugin`, plugin types.

One package, one version, one changelog. No `@patties/*` scope at launch.

## Subsystem map

| Spec | File | Replaces |
|---|---|---|
| [01-server](./phase-0/01-server.md) | `server/index.ts` | `http.createServer`, Hono |
| [02-router](./phase-0/02-router.md) | `router/index.ts` | Next router, Hono |
| [02b-filesystem-router](./phase-0/02b-filesystem-router.md) | `router/filesystem.ts` | `fast-glob` |
| [03-render](./phase-0/03-render.md) | `server/render.tsx` | — (uses `react-dom/server`) |
| [04-build](./phase-1/04-build.md) | `build/index.ts` | webpack/vite config |
| [05-dev-hmr](./phase-1/05-dev-hmr.md) | `dev/watcher.ts` | `chokidar` |
| [06-client-islands](./phase-1/06-client-islands.md) | `client/index.ts` | — (uses `react-dom/client`) |
| [07-middleware](./phase-1/07-middleware.md) | `app/middleware.ts` | Next middleware |
| [08-config](./phase-2/08-config.md) | `patties.config.ts` | `next.config.js` |
| [09-plugins](./phase-4/09-plugins.md) | `plugins/index.ts` | Next plugin system |
| [10-agents-and-tools](./phase-3/10-agents-and-tools.md) | `app/agents/`, `app/tools/` | — (net new) |
| [11-agents-md-generator](./phase-3/11-agents-md-generator.md) | build step | — (net new) |
| [12-edge-adapters](./phase-2/12-edge-adapters.md) | adapters | — (net new) |
| [13-conventions](./13-conventions.md) | repo-wide | — |
| [14-testing](./phase-1/14-testing.md) | `tests/fixtures/` | — |
| [15-claude-code-scaffold](./phase-0/15-claude-code-scaffold.md) | `CLAUDE.md`, `.claude/` (opt-in) | — (net new) |
| [17-dev-island-bundler](../draft/17-dev-island-bundler.md) | `src/dev/bundler.ts` (planned) | — (net new; design decision) |
| [18-dev-island-bundler-impl](../draft/18-dev-island-bundler-impl.md) | `src/dev/bundler.ts` (planned) | — (net new; implementation of 17) |

## Phase alignment

- Phase 0 ships: 01, 02, 02b, 03, 13 (minimal), 15 (scaffold contents).
- Phase 1 ships: 04, 05, 06, 07, 14.
- Phase 2 ships: 08, 12.
- Phase 3 ships: 10, 11.
- Phase 4 ships: 09.
- Dev-DX (post-launch): 17 (decision), 18 (impl), 26 (monorepo React single-copy resolution — prerequisite for `create-patties --monorepo`, cli/18), 27 (`patties run` task runner + output cache — encodes `rfc-bun-task-cache`) — see `framework/draft/`.
