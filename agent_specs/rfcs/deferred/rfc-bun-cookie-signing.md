---
rfc: bun-cookie-signing
title: Bun.Cookie signing — HMAC-signed cookies for sessions / auth
status: deferred
verdict: reject-for-v1
opened: 2026-05-27
reviewed: 2026-05-27
deferred_on: 2026-05-27
reaffirmed_on: 2026-05-31
target_phase: post-1.0
affects_specs: [07-middleware]
bun_unique: Bun-builtin
host_subsystem: framework/archive/phase-1/07-middleware (already exposes ctx.cookies via [[rfc-bun-cookies]]); future auth/session spec
comparable_elsewhere: Remix `createCookie({ secrets: [...] })` has built-in HMAC signing. Next has no first-party signed-cookie helper — users reach for `iron-session`, `jose`, `lucia`, or roll their own. Hono `getSignedCookie` / `setSignedCookie`.
---

## Reaffirmed deferred (2026-05-31)

**Stays deferred — not promoted, not dismissed.** The blessed auth story is
bring-your-own backend (spec 19 scaffolds auth as a UI+mock-data *pattern* and
puts the real backend out of scope), with **better-auth** the likely choice.
better-auth owns its own session cookies, signing, and CSRF — so a first-party
`ctx.cookies.sign()` is **not needed for auth** and would duplicate it. Kept in
`deferred/` (not out-of-scope) for the one residual case it could still serve:
**non-auth** signed cookies — flash messages, signed preferences — independent of
any auth library. Revisit if that concrete need appears, or if patties ever ships
a first-party auth/session spec. Original deferral verdict below.

## Review verdict (2026-05-27)

**Reject for v1; keep as future-work RFC.** Building a signed-cookies
API without a real auth/session consumer in the codebase risks
shipping API surface that no one actually uses — exactly what the
project conventions warn against ("Don't add features ... beyond
what the task requires"). The basic cookies surface ([[rfc-bun-cookies]])
already shipped; users who need signing today can compose
`Bun.CryptoHasher` + `ctx.cookies` themselves in ~10 lines of
middleware. The cost of that workaround is low; the cost of
shipping the wrong signing API and walking it back is high.

Revisit when:
- A first-party auth/session spec is being drafted (would consume
  signed cookies as its session-token primitive), OR
- A user opens an issue showing a real-world pattern they can't
  ergonomically express with the current cookies API +
  `Bun.CryptoHasher`.

**Re-evaluation trigger:** Each revisit should re-confirm the
secret-source decision (`Bun.secrets` vs env var vs config field)
— that landscape may have shifted by the time signing becomes
urgent. The "encrypted cookies (AES)" variant is a separate,
larger concern and explicitly out of scope for this RFC's revisit.

No spec changes. File preserved as `status: deferred`.

---

# RFC — Bun.Cookie signing (deferred)

## Summary

Add HMAC-signed cookies to `ctx.cookies`. Likely shape:
`ctx.cookies.sign(name, value)` and `ctx.cookies.verify(name)`
returning the unsigned value or `null` on tamper.

## Motivation

Sessions / auth is a real future need but nothing in the framework
currently consumes signed cookies. The original cookies RFC
([[rfc-bun-cookies]]) explicitly deferred signing so we could ship
the basic cookie surface first. Without an auth/session consumer,
the signing API has no concrete shape to validate against.

## Proposal (sketch — not yet refined)

- Add `ctx.cookies.sign(name, value)` and
  `ctx.cookies.verify(name)` methods.
- Secret source: precedence `Bun.secrets` → env var → config
  field. Multiple secrets for rotation (Remix pattern) by default.
- Opt-in per cookie (not auto-sign-all) to keep the contract small.
- HMAC via `Bun.CryptoHasher`; algorithm fixed at HMAC-SHA256.

## Trade-offs

- New API surface that wraps `Bun.CryptoHasher` — saves users
  from reaching for `iron-session` / `jose`.
- Secret-source bikeshed is real: `Bun.secrets` is Bun-only
  KV-style, env vars are universal, config fields are
  user-explicit.
- Auto-sign-all vs opt-in: opt-in keeps the contract small but
  requires users to remember to call `.sign()` for each cookie.

## Open questions

- Where does the signing secret live — config field, `Bun.secrets`,
  env var, or all with precedence?
- Multiple secrets for rotation (Remix's pattern)? Default yes.
- Encrypted cookies (AES) vs only signed — encrypted is a
  separate, larger RFC.
- Auto-sign all cookies vs opt-in per name — opt-in keeps the
  contract small.
