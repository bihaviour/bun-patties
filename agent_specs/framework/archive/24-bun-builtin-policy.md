---
spec: framework/24-bun-builtin-policy
title: Bun-builtin policy — Archive, ANSI helpers, one-shot hashing
status: accepted (implementation pending)
phase: conventions
file: src/build/, src/server/, packages/create-patties/, bin/patties.ts, plugins/
last_reviewed: 2026-05-27
supersedes: framework/archive/13-conventions (extends — codifies three more Bun-builtin replacements)
rfc: rfc-bun-archive, rfc-bun-cli-ansi, rfc-bun-hash
---

# Spec 24 — Bun-builtin policy

This spec encodes three RFCs at once — [[rfc-bun-archive]],
[[rfc-bun-cli-ansi]], [[rfc-bun-hash]] — as concrete applications
of the existing **bun-native rule**
(`.claude/rules/bun-native.md`). Each section says when to reach
for the Bun primitive, what it replaces from the Node ecosystem,
and where in the codebase it applies.

The framing: **patties' value isn't "do what Next can't" — it's
"do what every Node framework does, with a fraction of the
dependency surface."** This spec is the concrete embodiment of
that for three commonly-reached-for Node libs.

## 24.1 `Bun.Archive` — tar / zip in deploy plugins

### When to reach for it

A deploy plugin needs to package the build output into a single
uploadable artifact:

- AWS Lambda zip
- Google App Engine tar.gz
- generic tarball for `scp + extract`

### Concrete pattern

```ts
// plugins/deploy-lambda/src/package.ts
import { Bun } from "bun"

export async function packageForLambda(distDir: string): Promise<Uint8Array> {
  const archive = new Bun.Archive({ format: "zip" })
  for await (const entry of readDir(distDir)) {
    archive.append(entry.relPath, await Bun.file(entry.absPath).bytes())
  }
  return archive.toBytes()
}
```

### Replaces

- `tar` npm package
- `archiver` npm package
- `adm-zip` npm package

### Scope guardrails

- Use `Bun.Archive` only in deploy / packaging plugins, **not** in
  framework core. The framework emits a directory; packaging is a
  deploy concern.
- For tar.gz, prefer `format: "tar"` + post-gzip via `Bun.gzipSync`
  over a combined `"tar.gz"` mode (composability + clarity).
- Stream output to stdout when piping to vendor CLIs that accept
  stdin (`aws lambda update-function-code`).

## 24.2 ANSI text helpers — CLI formatting

### When to reach for them

The CLI (`bin/patties.ts`, `packages/create-patties`, and the dev
error overlay's terminal output) needs accurate string measurement
or wrapping that respects ANSI escapes:

- Multi-column tables in `patties dev` startup output
- Wrapped error messages with code frames in
  `cli/archive/07-logging-errors`
- Aligned status output in scaffolders / future
  `patties doctor`

### Concrete patterns

```ts
// width-aware truncation
import { Bun } from "bun"

function truncate(s: string, max: number): string {
  if (Bun.stringWidth(s) <= max) return s
  // ... walk grapheme-aware until fits
}

// strip ANSI before piping to non-TTY destinations
const plainLog = Bun.stripANSI(coloredLog)

// hard-wrap a paragraph at 80 cols, preserving inline styles
const wrapped = Bun.wrapAnsi(text, 80)
```

### Replaces

- `string-width` npm package
- `strip-ansi` npm package
- `wrap-ansi` npm package
- (collectively known as the chalk-ecosystem text utilities)

### Scope guardrails

- The CLI's color emission itself stays as-is — patties uses ANSI
  escapes inline (`\x1b[36m...\x1b[0m`) rather than reaching for
  `chalk` / `kleur` / `picocolors`. Color emission is two
  template literals; the dep tax isn't worth it.
- Use `Bun.stringWidth` before any padding / column math, never
  `String#length` — emoji and CJK characters are double-width.
- When writing logs to non-TTY (CI pipes), strip ANSI via
  `Bun.stripANSI` before emission.

## 24.3 One-shot hashing — `Bun.hash` / `Bun.sha`

### When to reach for them

A short-lived single buffer needs to be hashed and the streaming
`Bun.CryptoHasher` API is friction:

- Cache key for a single input (image cache, route cache)
- ETag derivation from a small response body
- Quick fingerprint for dev-mode change detection

### Concrete patterns

```ts
// non-crypto cache key (fast)
import { Bun } from "bun"

const cacheKey = Bun.hash(`${src}|${w}|${fmt}|${q}`).toString(36)

// crypto-grade hash for SRI / signed-cookie verify
const signature = Bun.sha(body, "sha256")  // Uint8Array

// streaming case stays on Bun.CryptoHasher
const hasher = new Bun.CryptoHasher("xxh64")
for await (const chunk of stream) hasher.update(chunk)
const final = hasher.digest("hex")
```

### Replaces

- `crypto.createHash(...).update(...).digest(...)` for one-shot
  cases (works, but verbose).
- The `xxhash-wasm` / `xxhash` npm packages for non-crypto
  fingerprints.

### Scope guardrails

- `Bun.CryptoHasher` is **still the right call for streaming
  inputs** — multi-chunk content (build outputs, large responses).
  This policy adds the one-shot form, not replaces the streaming
  form.
- Use `Bun.hash` (Wyhash) for non-security keys (cache fingerprints,
  ETags-as-suggestions). Use `Bun.sha` (SHA-2 family) for
  security-touching hashes (HMAC verification, SRI).
- Never use these for passwords — `Bun.password` is the only correct
  call there.

## Acceptance criteria

This spec lands as a **policy document** consumed by code reviewers
and future RFCs. It has no implementation to verify other than
"future PRs that reach for `tar` / `archiver` / `string-width` /
`crypto.createHash` are redirected to the Bun-builtin equivalent."

Concretely:

- A deploy-plugin RFC that proposes packaging via `archiver` is
  reviewed against this spec and rewritten to use `Bun.Archive`.
- A CLI improvement that imports `string-width` is reviewed against
  this spec and rewritten to use `Bun.stringWidth`.
- A new cache key implementation that uses
  `crypto.createHash("md5").update(x).digest("hex")` is reviewed
  against this spec and rewritten to `Bun.hash(x).toString(36)`.

The biome-check / typecheck hook does not enforce these
substitutions automatically — that's a code-review concern, not a
lint rule. A custom Biome lint rule could be added later if the
pattern recurs.

## Non-goals

- **Substitute every Node lib.** This spec covers three concrete
  cases; the broader rule is in `.claude/rules/bun-native.md`.
- **Block users from installing the Node alternatives.** Users
  can pull in `chalk` or `archiver` in their own app code — the
  policy applies to **framework and plugin code that ships in
  patties**, not user code.
- **Document every Bun primitive.** Only the three primitives whose
  encoding this spec carries.

## Out of this spec

- Future Bun-builtin acceptances (e.g. if `Bun.Image` proves
  insufficient and a wrapper helper is needed) get their own spec
  or extension.
- The bun-native rule itself (`.claude/rules/bun-native.md`) stays
  the canonical "always prefer Bun primitives" statement. This
  spec is its concrete application to three specific replacements.
