---
rfc: bun-config-formats
title: Bun.YAML / Bun.TOML / Bun.JSON5 (and JSONL) — non-TS config formats
status: deferred
verdict: reject-for-v1
opened: 2026-05-27
reviewed: 2026-05-27
deferred_on: 2026-05-27
target_phase: post-1.0
affects_specs: [08-config]
bun_unique: Bun-builtin
host_subsystem: framework/archive/phase-2/08-config (config loader — TS/JSON only today)
comparable_elsewhere: Next config is JS-only (`next.config.js` / `.mjs` / `.ts`). Astro uses TS. Nuxt accepts JSON. Most Node frameworks ship JS/TS configs; YAML/TOML are common in deploy/IaC tooling (`wrangler.toml`, `fly.toml`, GitHub Actions).
---

## Trigger retargeted (2026-05-31)

Confirmed deferred, with the pickup trigger **retargeted to the plugin system**:
revisit alt-config-formats when the plugin/deploy-adapter surface
([[framework/phase-4/09-plugins]]) lands and a plugin wants to read its own
vendor config (`wrangler.toml`, `fly.toml`) through the patties config loader.
Until a plugin pulls on it, TS-first stays the sole canonical format. The
TS-first-as-docs-default constraint below still holds; alt-formats remain opt-in
additive when they arrive.

## Review verdict (2026-05-27)

**Reject for v1; keep as future-work RFC.** Spec 08-config
consciously chose TS-first for editor IntelliSense and type-safety.
Adding YAML/TOML/JSON5 support without a real demand signal would
erode that virtue and invite churn over "which format is canonical."
The cost of adoption is low, but so is the demand signal — without
a real user, the choice of which format to support first is
arbitrary.

`Bun.JSONL` (newline-delimited JSON) doesn't fit the config use
case at all — it's a streaming-records format. Drops out of scope
on any revisit.

Revisit when:
- A user requests YAML/TOML config with a concrete use case (most
  likely scenario: a deploy adapter wants `wrangler.toml` /
  `fly.toml` alongside `patties.config.ts` and the loader is what
  stops it), OR
- A deploy plugin proposes overlapping with the config loader for
  vendor-config-format ergonomics.

**Re-evaluation trigger:** The TS-first contract should be
preserved on revisit — alt-formats should be opt-in additive, with
TS remaining the docs default. If revisited, scope likely shrinks
to TOML only (clearest deploy-adapter overlap); JSONL drops
entirely, and JSON5 is borderline (too close to JSON to justify a
separate format).

No spec changes. File preserved as `status: deferred`.

---

# RFC — Bun.YAML / Bun.TOML / Bun.JSON5 (deferred)

## Summary

Bun ships native parsers for YAML, TOML, JSON5, and JSONL.
Extending `08-config` to accept
`patties.config.{yaml,toml,json5}` would be a one-branch addition
to the config loader.

## Motivation

Some deploy targets naturally express config in TOML/YAML
(`wrangler.toml`, `fly.toml`, GitHub Actions). Patties is
opinionated TS-first; this RFC would widen the contract. It
remains hypothetical without a deploy adapter or user pulling on
it.

## Proposal (sketch — not yet refined)

- Extend `08-config`'s loader to accept
  `patties.config.{yaml,toml,json5}` in addition to TS/JSON.
- Drop JSONL entirely (wrong format shape for config).
- Possibly drop JSON5 (too close to JSON to justify).
- Error when multiple `patties.config.*` files exist in the same
  project (no precedence — be explicit).

## Trade-offs

- **Pro:** drops up to three potential deps (`js-yaml`,
  `@iarna/toml`, `json5`) when patties grows config-format needs.
- **Con:** erodes the "TS-first config gives users editor
  IntelliSense" virtue. New users discovering the framework via
  docs would hit "wait, which format is canonical?"
- **Con:** precedence bikeshed when multiple `patties.config.*`
  exist — error is the right answer but adds an error case.

## Open questions

- Which formats actually ship — drop JSONL (always), possibly drop
  JSON5?
- Source precedence when multiple `patties.config.*` files exist
  (probably error, but worth pinning).
- Does adopting this break the TS-first IntelliSense virtue?
