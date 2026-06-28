---
spec: framework/02-router
title: Router
status: completed
phase: 0
file: router/index.ts
last_reviewed: 2026-05-24
---

# Spec 02 — Router

## Purpose

Compile the user's `app/routes/` directory into the `routes:` object consumed by [01-server](./01-server.md). This spec is the integration point between the filesystem layout and `Bun.serve`'s native dispatcher. There is no HTTP framework — the output is a plain `Record<pattern, methodHandlers>` plus a fallback handler.

## Public surface

```ts
export interface CompiledRouter {
  routes: BunRoutes                          // shape consumed by Bun.serve({ routes })
  fallback: (req: Request) => Promise<Response>
}

export async function createRouter(options: RouterOptions): Promise<CompiledRouter>
```

`RouterOptions`:
- `appDir: string` — absolute path to user's `app/` folder.
- `middleware?: Middleware` — global middleware from `app/middleware.ts` (see [07-middleware](../phase-1/07-middleware.md)).
- `plugins?: Plugin[]` — resolved plugins from [09-plugins](../phase-4/09-plugins.md).
- `renderer: Renderer` — from [03-render](./03-render.md).

## Behavior

Wiring order is fixed: **user middleware → plugins → routes**.

1. Read the build-time route table (in production, inlined via a Bun macro per [04-build](../phase-1/04-build.md); in dev, computed at boot via [02b](./02b-filesystem-router.md)).
2. Compose the middleware chain: `[userMiddleware, ...pluginMiddlewares].reduce(...)` produces a `wrap(handler)` function that returns a middleware-wrapped handler. This is the framework-owned composer (~50 lines) from [07](../phase-1/07-middleware.md).
3. Iterate plugin `setup(server, ctx)` calls in declared order ([09](../phase-4/09-plugins.md)). Plugins register routes via `server.route(pattern, methodHandlers)`; the framework adds those routes to the same `routes` map *after* user middleware wrapping. Plugin-registered routes are wrapped by user middleware just like filesystem routes.
4. For each `RouteEntry`:
   - **Page routes** (`app/routes/**/*.tsx`): produce a `GET` handler that calls `renderer.renderPage(entry, req, ctx)`.
   - **API routes** (`app/routes/api/**/*.ts`): import the module; for each exported HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`), wrap with the middleware composer and add to `routes[pattern][method]`.
5. Return `{ routes, fallback }`. `fallback` is the middleware-wrapped 404 handler.

## Conventions enforced

- Dynamic segments: `[param].tsx` → `:param`, `[...rest].tsx` → `*` (Bun's catch-all).
- Index files: `index.tsx` → trailing-slash-stripped parent path.
- `app/routes/api/*` always becomes `/api/*`.
- Page routes only respond to `GET`; mutating verbs belong in API routes.
- Pattern strings emitted match `Bun.serve({ routes })` syntax exactly (no custom matcher dialect).

## Method-not-allowed

Patterns that match the URL but lack the requested method return `405` automatically — `Bun.serve({ routes })` does this for us when a method-keyed object is provided and the method is missing.

## Non-goals

- A handwritten path matcher on the Bun target. `Bun.serve({ routes })` is the matcher.
- Route-level config files (`page.config.ts`) — defer to a future RFC.
- Per-route middleware files — composition happens inside `app/middleware.ts` for now; a filesystem syntax is a future RFC.

## Acceptance criteria

- Given `app/routes/index.tsx`, `GET /` invokes the renderer with that module's default export.
- Given `app/routes/hotels/[city].tsx`, `GET /hotels/bali` resolves with `req.params.city === "bali"` (populated by Bun's native matcher).
- Given `app/routes/api/revenue.ts` exporting `GET`, `GET /api/revenue` invokes that export through the middleware composer.
- Unknown methods on a known API route return `405` (handled by `Bun.serve`, not by framework code).
- The compiled `routes` object contains no closures over Hono types or any HTTP framework — it's a plain map of plain functions.
