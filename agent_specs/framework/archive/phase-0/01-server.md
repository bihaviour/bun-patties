---
spec: framework/01-server
title: Server
status: completed
phase: 0
file: server/index.ts
last_reviewed: 2026-05-24
---

# Spec 01 — Server

## Purpose

Boot the HTTP server that hosts the user's Patties app. The framework wraps `Bun.serve()` and uses its native `routes:` map (introduced in Bun 1.2) as the dispatcher. There is no third-party HTTP framework — request matching, param parsing, and static-route handling all run in Bun's C++ path.

## Public surface

```ts
export function createServer(options: ServerOptions): { fetch: (req: Request) => Response | Promise<Response>, port: number }
export function startServer(options: ServerOptions): Bun.Server
```

`ServerOptions`:
- `port?: number` — default `3000`.
- `hostname?: string` — default `0.0.0.0`.
- `unix?: string` — optional Unix socket path. When set, `port`/`hostname` are ignored. Useful for self-hosted deploys behind nginx / Caddy.
- `reusePort?: boolean` — passed through to `Bun.serve`. Enables `SO_REUSEPORT` so multiple processes can bind the same port for horizontal scaling (`bun` adapter, multi-core hosts).
- `routes: BunRoutes` — the compiled route map from [02-router](./02-router.md). Each key is a Bun pattern (e.g. `/hotels/:city`); each value is a `Response` (precomputed) or a method-keyed object whose handlers are already wrapped by the user middleware composer.
- `fallback: (req: Request) => Response | Promise<Response>` — the `fetch:` handler. Wraps a 404 handler in the user middleware so unmatched paths still flow through middleware.
- `dev?: boolean` — when true, mounts the HMR WebSocket from [05-dev-hmr](../phase-1/05-dev-hmr.md).
- `staticRoutes?: Record<string, Response>` — prebuilt `Response` objects for `/_patties/client/*` chunks and (in the `bun` adapter) `/app/public/*` files. Bun.serve matches these *before* JS runs, so they never enter a handler.

## Behavior

1. Validate `options` (`routes` required; `port`/`hostname` and `unix` are mutually exclusive).
2. Construct `Bun.serve({ port, hostname, unix, reusePort, routes, fetch: fallback, websocket?, static: staticRoutes })`.
3. If `dev: true`, register the HMR upgrade handler on path `/__patties_hmr` via the `websocket` option and a routes entry that calls `server.upgrade(req)`.
4. Log the bound URL on startup (or socket path when `unix` is set).
5. Forward unhandled errors to a single error formatter; never let `Bun.serve` crash silently.

## Why native routes (not a userland router)

`Bun.serve({ routes })` matches paths in C++ before any JS runs, populates `req.params` natively, and short-circuits static responses without a JS round-trip. For the `bun` target the gain is real; more importantly, it removes a whole layer of abstraction (Hono `app.use`, `c.req.param`, etc.) and lets the framework expose plain `Request`/`Response`. The edge adapter ([12](../phase-2/12-edge-adapters.md)) compiles the same route table into a small JS matcher for vendors that don't accept `routes:` natively — same handlers, same `ctx`, different entrypoint shape.

## Dependencies

- `Bun.serve` only — no Node `http`, `https`, or `net`. No HTTP framework.

## Non-goals

- TLS termination (delegate to the edge / reverse proxy). `Bun.serve` supports `tls:`; users opting into a non-proxied deploy may configure it through `patties.config.ts` `server.tls`.
- Process supervision, clustering, graceful shutdown choreography beyond `server.stop()`.
- `Bun.serve({ routes })` alternatives. The framework does not maintain a hand-written matcher on the Bun target.

## Acceptance criteria

- `createServer({ routes, fallback })` returns an object whose `fetch` resolves end-to-end.
- A GET to `/` on a one-route fixture returns `200` and HTML.
- A POST to `/api/users/:id` resolves `req.params.id` via Bun's native parser; the handler receives the framework `ctx` populated by the middleware composer.
- Importing this module never pulls in `node:http` or `hono` (verified by a build-time check).
