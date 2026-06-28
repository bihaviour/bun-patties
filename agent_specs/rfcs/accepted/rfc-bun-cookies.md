---
rfc: bun-cookies
title: Bun.Cookie / Bun.CookieMap — adopt native cookie API in middleware
status: encoded
encoded_in: ["framework/phase-1/07-middleware"]
encoded_on: 2026-05-24
verdict: accept
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 1
affects_specs: [07-middleware, 01-server, 13-conventions]
---

## Review verdict (2026-05-24)

**Accept.** Closes the auth-shaped hole in spec 07. With Hono removed, the cookie story gets simpler — `ctx.cookies` is a thin pass-through to `Bun.CookieMap` rather than a layer over `c`.

Scope tightening:
- The handler/middleware `ctx` (decided in the Hono-removal pass) exposes `ctx.cookies: Bun.CookieMap` directly — no separate `hono/cookie` to displace.
- Mutations are written back as `Set-Cookie` headers by the framework's response finalizer, not by middleware explicitly.
- Signed cookies are deferred to a follow-up RFC; not blocking Phase 1.

Depends on: the `ctx` shape from the Hono-removal pass.

---

# RFC — Bun.Cookie integration

## Summary
Bun ships `Bun.Cookie` and `Bun.CookieMap` plus a `request.cookies` accessor exposed by `Bun.serve`. The classes parse, validate, and serialize cookies (including SameSite, Partitioned, Priority, expiration math) without userland deps. Patties should expose `ctx.cookies` in middleware/handlers as a thin pass-through to `Bun.CookieMap`.

## Motivation
07-middleware currently hand-waves auth and session work ("where do I do auth / logging / headers?") without naming a cookie primitive. Every realistic Patties app needs cookies for session IDs, CSRF tokens, theme preference, A/B bucketing. Reaching for `cookie` from npm contradicts the Bun-native commitment in 00-overview. `Bun.CookieMap` is also the prerequisite for `Bun.CSRF` (separate RFC) and any future session story.

## Proposal
- 07-middleware: `ctx.cookies: Bun.CookieMap` is a first-class field on the handler/middleware context. Populated from `request.cookies` provided by `Bun.serve`. Mutations are flushed to `Set-Cookie` headers by the framework's response finalizer.
- 01-server: document that `Bun.serve` provides cookies automatically — Patties does not re-parse `Cookie:` headers.
- 13-conventions: name `Bun.CookieMap` as the canonical cookie API; forbid `cookie`, `cookie-parser`, `tough-cookie`.

Sample:
```ts
// app/middleware.ts
export default async (req, ctx, next) => {
  if (!ctx.cookies.get("sid")) {
    ctx.cookies.set("sid", crypto.randomUUID(), { httpOnly: true, sameSite: "lax" });
  }
  return next();
};
```

## Trade-offs
- Locks middleware contract to `Bun.CookieMap` shape — if Bun changes signatures we follow.
- Edge adapter (12) must polyfill or shim for vendors that don't run Bun (Workers, Vercel). Acceptable — the adapter already abstracts `Bun.serve`.

## Open questions
- Do we expose mutation as `set(name, value, opts)` or as a Map-style assignment? Match Bun's API exactly to avoid divergence.
- Signed cookies: defer to a follow-up or fold in here via `cookies.sign(secret)` helper?
