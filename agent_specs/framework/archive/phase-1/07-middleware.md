---
spec: framework/07-middleware
title: Middleware
status: draft
phase: 1
file: app/middleware.ts (user) · composer in middleware/index.ts
last_reviewed: 2026-05-24
---

# Spec 07 — Middleware

## Purpose

Allow users to wire one global middleware in front of every route. This is also the answer to "where do I do auth / logging / headers?" — replacing Next-style `getServerSideProps`. The framework owns a small linear composer (~50 lines) and a `ctx` shape; there is no HTTP framework underneath.

## Types

```ts
export interface PattiesContext {
  params: Record<string, string>            // populated by Bun.serve's native matcher
  cookies: Bun.CookieMap                    // from req.cookies (see rfc-bun-cookies)
  env: EnvLookup                            // adapter-aware env reader; see 08-config
  aiContext?: AiContext                     // populated when agents/tools are present; see 10
  csrf?: { token(): string; verify(t: string | null): boolean }   // populated when CSRF is enabled
  vars: Record<string, unknown>             // free-form bag for middleware/plugins to attach to
  url: URL                                  // parsed once, cached
  json(body: unknown, init?: ResponseInit): Response
  html(body: string | ReadableStream, init?: ResponseInit): Response
  redirect(to: string, status?: 301 | 302 | 303 | 307 | 308): Response
}

export type Handler = (req: Request, ctx: PattiesContext) => Response | Promise<Response>

export type Middleware = (
  req: Request,
  ctx: PattiesContext,
  next: () => Promise<Response>,
) => Promise<Response>

export function defineMiddleware(m: Middleware): Middleware       // identity, for typing
export function compose(middlewares: Middleware[], handler: Handler): Handler
```

`compose` is the framework's full middleware abstraction — no `app.use`, no Hono `every`/`some`, no `MiddlewareHandler`. Users assemble their own chains inside `app/middleware.ts` if they want multiple middlewares.

## User contract

```ts
// app/middleware.ts
import { defineMiddleware } from "patties/middleware"

export default defineMiddleware(async (req, ctx, next) => {
  const start = performance.now()
  const res = await next()
  console.log(req.method, ctx.url.pathname, res.status, `${(performance.now() - start) | 0}ms`)
  return res
})
```

Composing multiple middlewares in a single export:

```ts
import { defineMiddleware, compose } from "patties/middleware"

const logger: Middleware = async (req, ctx, next) => { /* ... */ }
const auth:   Middleware = async (req, ctx, next) => { /* ... */ }

export default defineMiddleware(async (req, ctx, next) =>
  compose([logger, auth], () => next())(req, ctx)
)
```

## Framework behavior

1. During `createRouter`, attempt to import `app/middleware.ts`.
2. If present and the default export is a function, treat it as the global middleware.
3. If absent, skip silently (no middleware).
4. If the export is not a function, throw a clear error at boot.
5. Every handler (page, API, plugin-mounted) is registered as `compose([userMiddleware, ...pluginMiddlewares], handler)` inside the `routes:` object passed to `Bun.serve`. The fallback (404) handler is wrapped identically.

User middleware sits at the outermost edge of every request — it sees plugin-mounted routes, filesystem routes, and the 404 fallback alike. See [02-router](../phase-0/02-router.md) for the full wiring order.

## `ctx.cookies`

Populated from `request.cookies` (provided natively by `Bun.serve`). Mutations are flushed to `Set-Cookie` headers by the framework's response finalizer — middleware/handlers never call `cookies.toSetCookieHeaders()` directly. See [[rfc-bun-cookies]].

## `ctx.csrf` (Phase 1 minimal, Phase 2 auto-injection)

When CSRF is enabled in `patties.config.ts`, `ctx.csrf` exposes:
- `token()` — generates a token via `Bun.CSRF.generate(secret)`, sets the `_csrf` cookie if absent, returns the token for embedding in forms.
- `verify(submitted)` — checks `Bun.CSRF.verify(submitted, secret)`.

Phase 1: users render `<input type="hidden" name="_csrf" value={ctx.csrf!.token()}>` themselves. Phase 2 (depends on [[rfc-bun-htmlrewriter]]): the renderer auto-injects the input into every POST `<form>` unless tagged `data-no-csrf`.

On non-Bun targets, the adapter substitutes a WebCrypto HMAC implementation of the same scheme. See [[rfc-bun-csrf]].

## Composition

Users compose multiple middlewares themselves inside one default export using the `compose` helper. The framework does not invent a stack abstraction beyond `compose`.

## Non-goals

- A per-route middleware filesystem syntax. Deferred to a future RFC.
- A `getServerSideProps` equivalent.
- Re-implementing Hono's `every`/`some`/`createMiddleware` — `compose` is the whole API.

## Acceptance criteria

- A fixture with a logging middleware sees one log line per request to any route (page, API, plugin, 404).
- Removing `app/middleware.ts` and restarting causes the server to boot with no middleware and no warning.
- Exporting `default = 42` causes boot to fail with an error naming the file.
- `ctx.cookies.set("sid", id)` results in a `Set-Cookie: sid=...` header on the response without any explicit serialization call by the user.
- A request to a non-existent path passes through the user middleware before reaching the 404 fallback.
