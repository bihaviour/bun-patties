---
rfc: bun-import-attributes
title: Import attributes — macros, text, toml, file imports as first-class
status: encoded
encoded_in: ["framework/phase-1/04-build", "framework/phase-1/05-dev-hmr"]
encoded_on: 2026-05-24
verdict: accept-with-scope
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 2
affects_specs: [04-build, 09-plugins, 11-agents-md-generator, 13-conventions]
---

## Review verdict (2026-05-24)

**Accept with scoped policy.** Spec 00 promises Bun macros; this RFC redeems that promise.

### Macro policy (decided 2026-05-24)

**Required to be macros** (compiler-enforced "no runtime read" guarantee):
- Route table (`scanRoutes` output) — closes the spec 04 promise that production bundles contain no `Bun.Glob` call.
- `env.public` values inlined into the client bundle.
- Client manifest (island name → chunk URL).
- AGENTS.md content hash for cache busting (the file itself stays generated at build time, but the hash gets inlined for the dev banner).

**Optional** (may be import-attribute or runtime read):
- SQL files (`with { type: "text" }` preferred).
- Email/HTML templates (`with { type: "text" }` preferred).
- TOML config blobs (`with { type: "toml" }` preferred when the file is known at build time).
- SQLite seed databases (`with { type: "sqlite" }`).

Rule of thumb: anything *the framework builds for you* must be a macro; anything *your app reads* may be either.

### `--hot` interaction

Macros re-evaluate on `bun --hot` when their input files change. This is verified by the smoke test in [[rfc-bun-hot-reload]]. If a macro depends on a file Bun's dep tracker doesn't follow, the developer adds the dep explicitly via `import "./watched-file" with { type: "file" }` in the macro source.

### Testing

Macros are unit-tested by importing them in a build-time test harness (`bun test` with a fixture that runs `Bun.build` and asserts on the emitted output). [[14-testing]] gets a new section.

---

# RFC — `with { type: ... }` import attributes

## Summary
Bun supports five import attribute types: `macro` (build-time function evaluation), `text` (string literal), `toml` (parsed object), `json` (parsed object), `file` (path/URL after bundling), and `sqlite` (embedded DB). 00-overview already promises "Bun macros" but no Patties spec actually says *where* macros are allowed, what counts as a macro, or how the other import attributes fit. This RFC closes that gap.

## Motivation
- Macros let route metadata, manifest generation, and AGENTS.md scaffolding (11) run at build time instead of boot. Concrete win: turn `scanRoutes()` into a macro so the route table literally inlines, satisfying 08-config's "no `Bun.Glob` calls in production bundle" guarantee with compiler-enforced certainty.
- `with { type: "text" }` for SQL files (09-plugins) and email templates beats `Bun.file().text()` because it's tree-shakeable.
- `with { type: "toml" }` for `patties.toml` style config beats parsing at runtime.

## Proposal
- 04-build: document the supported import attribute types and require Patties' macros to be pure (no I/O at module top level besides FS reads in the macro file itself).
- 09-plugins: macros may be authored by plugin packages; plugin docs must list which macros they export.
- 13-conventions: ban runtime JSON/TOML reads when a static import attribute can replace them.
- 11-agents-md-generator: convert the generator's filesystem scan into a macro so AGENTS.md is regenerated on every build, not via a separate CLI step.

Sample:
```ts
import routes from "./_scanRoutes.ts" with { type: "macro" };
import schema from "./schema.sql"   with { type: "text"  };
import config from "./patties.toml" with { type: "toml"  };
```

## Trade-offs
- Macros run in a sandboxed build-time context — they cannot import runtime-only code. Easy to footgun.
- Errors in macros surface at build time with stack traces inside the bundler — harder to debug than a runtime throw.

## Open questions
- Which existing spec touchpoints should *require* a macro vs. permit either? (Likely: route table = required, manifest = required, AGENTS.md = optional CLI for non-bundled flows.)
- Do macros run during `Bun.build` only, or also under `bun --hot`? Test.
- How do tests stub a macro's output (14-testing)?
