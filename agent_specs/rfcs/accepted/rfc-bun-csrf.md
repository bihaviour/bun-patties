---
rfc: bun-csrf
title: Bun.CSRF — native CSRF token generation/verification in middleware
status: encoded
encoded_in: ["framework/phase-1/07-middleware"]
encoded_on: 2026-05-24
verdict: accept-with-deferral
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 1
affects_specs: [07-middleware, 13-conventions, 12-edge-adapters]
depends_on: [rfc-bun-cookies, rfc-bun-htmlrewriter]
---

## Review verdict (2026-05-24)

**Accept, depends on [[rfc-bun-cookies]] and (for renderer auto-injection) [[rfc-bun-htmlrewriter]].**

Scope split:
- **Phase 1 (this RFC):** `Bun.CSRF` exposed as `ctx.csrf.token()` / `ctx.csrf.verify(submitted)`. Users render the hidden input themselves in their forms. No renderer-side magic.
- **Phase 2 (folded into HTMLRewriter RFC):** opt-in auto-injection of `<input type="hidden" name="_csrf">` into POST forms via the HTMLRewriter pipeline.

Edge-adapter parity (12): outside Bun, fall back to a WebCrypto HMAC implementation of the same scheme. Adapter responsibility.

---

# RFC — Bun.CSRF integration

## Summary
Bun ships `Bun.CSRF.generate(secret, opts?)` and `Bun.CSRF.verify(token, secret, opts?)` — HMAC-signed CSRF tokens with optional expiration and `sameSite` semantics. Patties middleware (07) should expose a one-liner CSRF helper that wraps this API rather than telling users to bring `csurf` or roll their own HMAC.

## Motivation
07-middleware leaves CSRF as an unanswered "where does this live" question. Any framework that ships forms (and Patties does, via 02b filesystem routes and 06 islands) needs an answer. `Bun.CSRF` is zero-dep, constant-time, and pairs naturally with `Bun.CookieMap` (see `rfc-bun-cookies.md`) and `Bun.secrets` for the signing secret.

## Proposal
- 07-middleware: add `ctx.csrf.token()` (generates + sets the cookie if absent) and `ctx.csrf.verify(submitted)` (returns boolean). Users render the hidden input in their forms in Phase 1.
- 03-render: opt-in renderer auto-injection of `<input type="hidden" name="_csrf">` for POST forms — deferred to Phase 2 via [[rfc-bun-htmlrewriter]]. Opt-out attribute will be `<form data-no-csrf>`.
- 13-conventions: ban `csurf`, `lusca`.

Sample:
```ts
export const POST = async (ctx) => {
  if (!ctx.csrf.verify(ctx.formData.get("_csrf"))) return new Response("403", { status: 403 });
  // ...
};
```

## Trade-offs
- Only meaningful for cookie-bearing browsers; pure JSON APIs called with bearer tokens skip CSRF — middleware must allow opt-out.
- Adds an implicit cookie on first GET — surprise factor; documented in 07.

## Open questions
- Secret source: `Bun.env.PATTIES_CSRF_SECRET` required, or auto-generated per process in dev?
- Token rotation policy.
- Edge adapter parity — `Bun.CSRF` ships in Bun runtime only; vendor adapters need a shim or fall back to WebCrypto HMAC.
