---
rfc: bun-serve-routes
title: Bun.serve routes — adopt native routes map (Hono removed)
status: encoded
encoded_in: ["framework/phase-0/01-server", "framework/phase-0/02-router", "framework/phase-0/02b-filesystem-router", "framework/phase-2/12-edge-adapters"]
encoded_on: 2026-05-24
verdict: accept-as-primary-router
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 1
affects_specs: [01-server, 02-router, 02b-filesystem-router, 07-middleware, 09-plugins, 12-edge-adapters]
---

## Review verdict (2026-05-24)

**Accept — and promote to the primary routing mechanism.** Originally rejected because Hono's middleware model would diverge from `Bun.serve({ routes })`. With the Hono-removal decision (2026-05-24), that objection disappears: there's only one router, and it's `Bun.serve`'s native `routes:` map on the Bun target. The edge adapter (12) compiles the same route table into a plain `fetch` dispatcher for vendors whose runtime doesn't accept `routes:` natively.

This RFC now subsumes spec 02's old "Hono assembly" purpose:
- 02b's `RouteEntry[]` is consumed by 01 to build the `routes:` object directly.
- Middleware composes via the new `ctx`-based linear composer (decided 2026-05-24) — wrapped around each handler at registration time, not by a Hono `app.use`.
- Per-route handlers receive `(req, ctx)` where Bun's native `req.params` populate `ctx.params`.

The "two code paths kept in sync" concern from the original draft is real but bounded: the edge adapter implements a tiny JS matcher (~30 lines) that walks the same `RouteEntry[]`. Conformance is enforced by running the integration fixture set against both targets.

---

# RFC — Bun.serve native routes map

## Summary
Modern `Bun.serve` accepts a `routes:` object alongside `fetch:` — keys are path patterns (`/users/:id`), values are either method-keyed handler objects or `Response` instances. Bun matches the route in C++ before calling JS, with typed `req.params`. Patties should mount its compiled route table through `routes:` instead of routing entirely in JS inside `fetch:`.

## Motivation
01-server today wires `fetch` to call `router.fetch` which iterates the compiled table. That's correct and fast, but loses Bun's native route matcher, native param parsing, and the static-html-import shortcut. Pages and `static:` already use the native fast path; API routes should too.

## Proposal
- 01-server: build a `routes:` object from the `RouteEntry[]`. Each handler is wrapped in the framework's middleware composer before registration so user middleware sees every request. The `fetch:` handler is the catch-all 404.
- 02-router: this spec's purpose becomes "compose the routes object" — it no longer assembles a Hono app. Pattern compilation emits Bun-compatible strings (`/users/:id`, `/files/*`).
- 02b: filesystem router's output already provides paths; add a `bunPattern` field consumed by 01.
- 07-middleware: the framework owns a ~50-line linear composer; handlers receive `(req, ctx)`.
- 09-plugins: `setup(server, ctx)` receives the route-registration API (`server.route(pattern, methodHandlers)`) instead of a Hono `app`.
- 12-edge-adapters: edge target compiles the same `RouteEntry[]` into a `fetch(req)` dispatcher (~30 lines of matcher). Same handlers, same `ctx`, different entrypoint shape.

Sample:
```ts
Bun.serve({
  routes: {
    "/api/users/:id": {
      GET:  compose([userMiddleware], handlers.usersGet),
      POST: compose([userMiddleware], handlers.usersPost),
    },
    "/healthz": new Response("ok"),
  },
  fetch: compose([userMiddleware], notFoundHandler),
});
```

## Trade-offs
- Two route-dispatch implementations (Bun-native `routes:` vs. edge JS matcher). Bounded by a shared `RouteEntry[]` and conformance tests.
- Removing Hono means losing the Hono middleware ecosystem (`hono/jwt`, `hono/cors`, etc.). Trade-off accepted — equivalents land as `@patties/*` plugins.

## Open questions
- Param typing — generate `.d.ts` from the route table at build time, or rely on Bun's inferred `req.params`? Leaning generated, for editor go-to-def.
- How does the middleware composer surface in user code? Likely `defineMiddleware(handler)` from `patties/middleware`.
