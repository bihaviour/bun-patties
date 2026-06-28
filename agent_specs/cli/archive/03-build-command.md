---
spec: cli/03-build-command
title: patties build
status: completed
phase: 1
file: cli/commands/build.ts
last_reviewed: 2026-05-23
---

# CLI Spec 03 — `patties build`

## Purpose

Produce a production artifact in `outDir` (default `.patties/` → `dist/` for the deploy adapter), tailored to the configured target.

## Usage

```
patties build [--target bun|edge] [--out <dir>] [--cwd <path>] [--config <path>]
```

## Behavior

1. Load config ([06](./06-config-loading.md)). `--target` overrides `config.target`. Allowed values: `bun`, `edge`. `cloudflare` / `vercel` / etc. are **deploy plugin** concerns, not build targets.
2. Invoke the framework `build()` ([04](../../framework/draft/phase-1/04-build.md)) with `mode: "production"`.
3. Run the target's adapter `emit` step ([12](../../framework/draft/phase-2/12-edge-adapters.md)). For `edge`, this produces a portable `dist/worker.js`. Any installed deploy plugin's `onBuildEnd` hook then emits vendor-specific config (`wrangler.toml`, `vercel.json`, etc.).
4. Generate `AGENTS.md` ([11](../../framework/draft/phase-3/11-agents-md-generator.md)) at the project root.
5. Print a build summary:
   - Time taken.
   - Output dir.
   - Bundle sizes per chunk (gzipped, computed via `Bun.gzipSync`).
   - Number of routes, islands, agents, tools, jobs.
   - List of deploy-plugin artifacts emitted (if any).
6. Exit 0 on success, 1 on any build error.

## Determinism

- Same source tree → identical core outputs. Vendor-specific config files emitted by deploy plugins may include timestamps (`compatibility_date` etc.); the core `dist/worker.js` is byte-identical across re-runs.
- `AGENTS.md` must be byte-identical across re-runs with no source change.

## Acceptance criteria

- `patties build --target edge` produces `dist/worker.js`, `dist/assets/`, and `AGENTS.md`.
- With `@patties/deploy-cloudflare` installed, the same command also produces `dist/wrangler.toml`.
- A failed user route compile yields a non-zero exit and a diagnostic naming the file and line.
- The summary always prints, even on partial failure (best-effort).
- `patties build --target node` is rejected at config-validation time (Node is not a target).
