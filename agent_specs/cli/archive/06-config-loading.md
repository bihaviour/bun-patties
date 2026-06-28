---
spec: cli/06-config-loading
title: Config Loading
status: completed
phase: 0-2
file: cli/config.ts
last_reviewed: 2026-05-23
notes: Phase 0 ships a defaults-only skeleton; Phase 2 adds the full validated surface.
---

# CLI Spec 06 — Config Loading

## Purpose

A single shared routine every CLI command calls to find, load, and validate `patties.config.ts`. The framework spec [08-config](../../framework/draft/phase-2/08-config.md) defines the file's *shape*; this spec defines the CLI's *resolution* behavior.

## Public surface

```ts
export interface ResolvedConfig { /* see framework spec 08 */ }
export interface LoadOptions {
  cwd: string
  configPath?: string         // from --config flag
  overrides?: Partial<ResolvedConfig>  // from per-command flags like --target
}

export async function loadConfig(opts: LoadOptions): Promise<ResolvedConfig>
```

## Resolution order

1. If `configPath` is set, use it. Error if the file does not exist.
2. Otherwise look in `cwd` for `patties.config.ts`, then `.js`, then `.mjs`. First hit wins.
3. If nothing is found, return defaults — Patties must run with zero config.

## Load

- Import the file via Bun's native TS support.
- The default export must be the object (or the result of `defineConfig(...)`).
- Validate with Zod; produce a normalized config.
- Apply `overrides` after validation, validating again (so `--target node` still rejects).

## Caching

- Loads are not cached across CLI invocations.
- Within a single invocation (e.g. `dev` re-reading after a restart), the loader uses a content-hash cache to skip re-validation when the file is unchanged.

## Errors

Validation errors include:
- Absolute path to the offending file.
- The path within the config (e.g. `env.required[0]`).
- The expected vs received value.
- A suggested fix when possible (closest legal enum value).

## Acceptance criteria

- Running any command in an empty directory uses defaults without warning.
- `--config ./custom.ts` loads that file; if missing, the command exits 2 with the resolved path in the message.
- An invalid `target` value in config is caught before any build or server work begins.
