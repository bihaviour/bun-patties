---
spec: framework/13-conventions
title: Conventions & Critical Rules
status: completed
phase: all
file: applies repo-wide
last_reviewed: 2026-05-24
---

# Spec 13 — Conventions & Critical Rules

## File conventions (user `app/` folder)

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

## Reserved prefixes

- Files starting with `_` are private and never routed.
- The URL prefix `/__patties_*` is reserved (dev HMR, internal endpoints).
- The output directory prefix `/_patties/*` is reserved (client bundle URLs).

## Critical rules for agents working on this codebase

These are the bright lines. An agent violating any of them is wrong, regardless of how reasonable the change looks.

1. **Never import from `"next"`.** This is not Next.js.
2. **Never use Node.js `http` module.** Use `Bun.serve`.
3. **Never use webpack or vite.** Use `Bun.build`.
4. **Never use `fs.watch` or `chokidar`.** Use `bun --watch`.
5. **Use React for rendering.** Server: `react-dom/server.renderToReadableStream`. Client: `react-dom/client.hydrateRoot`. Never import from `hono/jsx` or `hono/jsx/dom`. Never use `renderToPipeableStream` (Node-only) or `renderToString` (no streaming).
6. **`tsconfig.json` must set `"jsx": "react-jsx"` and `"jsxImportSource": "react"`.** JSX is resolved through `react/jsx-runtime`; no manual `import React` in user code.
7. **All routes are plain handlers `(req: Request, ctx: PattiesContext) => Response | Promise<Response>`.** No HTTP framework — `Bun.serve({ routes })` dispatches; the framework owns a ~50-line middleware composer and the `ctx` shape. Never import from `"hono"`.
8. **Islands must live in `app/islands/`.** No exceptions.
9. **API routes export `GET`, `POST`, `PUT`, `DELETE` named functions.** Default exports are reserved for page components.
10. **Middleware exports a default function** typed as `Middleware = (req, ctx, next) => Promise<Response>`. Never `MiddlewareHandler` from Hono.
11. **No `getServerSideProps` or Next-style data loaders.** Use middleware or route handlers.
12. **Use Bun primitives for I/O, not `node:fs`/`node:child_process`.** File reads → `Bun.file(path).text()/.json()/.bytes()`. File writes → `Bun.write(path, data)`. Subprocess → `Bun.spawn` or `Bun.$` (Bun Shell). Hashing → `Bun.CryptoHasher`. Env reads → `Bun.env` (Bun target) or the adapter's `getEnv()` (edge). Password hashing → `Bun.password`. SQLite → `bun:sqlite`. Postgres → `Bun.sql`. Redis → `Bun.RedisClient`. S3-compatible storage → `Bun.S3Client`. `node:fs` is only acceptable when a Bun built-in does not exist for the task.

## Naming

- Module file names: kebab-case (`booking-flow.ts`).
- Exported components: PascalCase.
- Agent and tool `name` fields: kebab-case, **must match their filename basename**. Mismatches and duplicate `name`s are boot errors — see [10-agents-and-tools](./phase-3/10-agents-and-tools.md#name-enforcement).

## Commit format

`feat(router): add dynamic segment support` — conventional commits drive `CHANGELOG.md`.
