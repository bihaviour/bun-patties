# {{PROJECT_NAME}}

Built with Patties — Bun-native full-stack meta-framework.

> This file is read by Codex CLI and other AGENTS.md-aware tools. Patties also
> auto-regenerates a live inventory `AGENTS.md` on `patties build` — trust the
> generated inventory for routes/islands/agents/tools, and this file for rules
> and conventions.

## Stack

Bun runtime · `Bun.serve({ routes })` dispatcher · React renderer (`react-dom/server` + `react-dom/client`) · `{{DEPLOY_TARGET}}` deploy.

## File conventions

| Path | Becomes |
|---|---|
| `app/routes/index.tsx` | `/` |
| `app/routes/about.tsx` | `/about` |
| `app/routes/hotels/[city].tsx` | `/hotels/:city` |
| `app/routes/api/revenue.ts` | `/api/revenue` |
| `app/islands/counter.tsx` | interactive island `Counter` |
| `app/agents/booking.ts` | agent `booking` |
| `app/tools/search.ts` | MCP tool `search` |
| `app/middleware.ts` | global middleware |
| `patties.config.ts` | framework config |

Files starting with `_` are private and never routed. The URL prefix `/__patties_*` and output directory `/_patties/*` are reserved.

## Critical rules

1. Never import from `"next"`.
2. Never use Node.js `http`, `fs.watch`, or `chokidar`. Use `Bun.serve` and `bun --watch`.
3. Never use webpack or vite. Use `Bun.build`.
4. Use React for rendering. Server: `react-dom/server.renderToReadableStream`. Client: `react-dom/client.hydrateRoot`. Never `renderToPipeableStream` or `renderToString`. Never `hono/jsx` or `hono/jsx/dom`.
5. `tsconfig.json` sets `"jsx": "react-jsx"` and `"jsxImportSource": "react"` — no manual `import React` in user code.
6. All routes are plain `(req: Request, ctx: PattiesContext) => Response | Promise<Response>`. Never import from `"hono"`.
7. Islands live in `app/islands/` — no exceptions.
8. API routes export named `GET`, `POST`, `PUT`, `DELETE` functions. Default exports are reserved for page components.
9. Middleware default-exports a `Middleware = (req, ctx, next) => Promise<Response>`. Never `MiddlewareHandler` from Hono.
10. Use Bun primitives for I/O: `Bun.file`, `Bun.write`, `Bun.spawn`, `Bun.CryptoHasher`, `Bun.env`, `Bun.password`, `bun:sqlite`, `Bun.sql`, `Bun.RedisClient`, `Bun.S3Client`. `node:fs` only when no Bun built-in exists.

## How to run

- `bun install`
- `bun dev` — start the dev server
- `bun build` — build for production
- `bun test`
