---
rfc: bun-hash
title: Bun.hash / Bun.sha — one-shot hash helpers
status: encoded
encoded_in: ["framework/draft/24-bun-builtin-policy"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: 1
affects_specs: [24-bun-builtin-policy, 04-build, 22-image-pipeline]
bun_unique: Bun-builtin
host_subsystem: framework/draft/24-bun-builtin-policy § 24.3 (one-shot hashing)
comparable_elsewhere: Node's `crypto.createHash` / `crypto.subtle.digest`. The `xxhash` / `xxhash-wasm` npm packages for non-crypto fingerprints.
---

## Review verdict (2026-05-27)

**Accept** as a policy adoption — and an active complement to
the existing `Bun.CryptoHasher` usage. The framework already
uses `Bun.CryptoHasher` for streaming hash flows (asset content
hashing in spec 04). For one-shot cases — cache keys, ETags,
quick fingerprints — the streaming API is friction.
`Bun.hash` (Wyhash) and `Bun.sha` (SHA family) are one-call
ergonomics.

This RFC was originally drafted as borderline out-of-scope. The
spec-22 image pipeline tipped it over: image cache keys
(`${src}|${w}|${fmt}|${q}` → short hash) are the canonical
one-shot case, and reaching for `Bun.CryptoHasher` there is
unergonomic.

Codified as section 24.3 of the **Bun-builtin policy spec**
([[framework/draft/24-bun-builtin-policy]]).

Scope pins:
- **One-shot cache keys** use `Bun.hash` (non-crypto, fast,
  Wyhash).
- **Crypto-grade hashing** (HMAC verify, SRI) uses `Bun.sha`
  (SHA-2 family).
- **Streaming inputs stay on `Bun.CryptoHasher`** — this policy
  adds the one-shot form, doesn't replace the streaming form.
- **Passwords always use `Bun.password`** — neither of these
  primitives is correct for password storage.

Out of scope for this RFC:
- **Custom HMAC wrappers** — `Bun.sha` is the building block;
  HMAC composition is per-caller (see cookie-signing, image
  signing).
- **Performance comparisons across hash algorithms** — left to
  profiling, not specification.

---

# RFC — Bun.hash / Bun.sha → one-shot hash helpers

## Summary

`Bun.hash(input)` returns a non-crypto fast hash (Wyhash) as a
`bigint`. `Bun.sha(input, algorithm)` returns a SHA family digest
as a `Uint8Array`. Both are one-call alternatives to
`Bun.CryptoHasher`'s streaming-builder API.

## Motivation

The framework's hashing needs split into two shapes:
- **Streaming**: large content, fingerprinted with
  `Bun.CryptoHasher` already (spec 04 § Hashing).
- **One-shot**: small known input (cache key, ETag suggestion).
  Today, even these reach for `Bun.CryptoHasher` because that's
  the documented helper. The image-pipeline cache keys
  (`${src}|${w}|${fmt}|${q}`) make the one-shot pattern routine
  enough to deserve first-party documentation.

## Proposal

See [[framework/draft/24-bun-builtin-policy|spec 24]] § 24.3 for
the policy and concrete patterns. Summary:

- Use `Bun.hash(x).toString(36)` for non-security cache keys
  (image cache, route cache).
- Use `Bun.sha(body, "sha256")` for one-shot crypto-grade hashes
  (SRI, HMAC composition).
- Keep `Bun.CryptoHasher` for streaming flows (build-output
  fingerprints, large response bodies).

## Trade-offs

- **Two hash families documented.** Users now have to know when
  to use Wyhash vs SHA. Mitigation: the policy text spells out
  the distinction explicitly.
- **`Bun.hash` is non-crypto.** Don't reach for it for HMAC
  signing; it's not collision-resistant under adversarial input.

## Open questions

- **Wyhash bigint output → string encoding** — `.toString(36)` is
  compact (~12 chars). `.toString(16)` is hex-conventional.
  Choose per-use-case; document examples for both.
- **`Bun.sha` algorithm default** — explicit `"sha256"` parameter
  always; no default that could change.
