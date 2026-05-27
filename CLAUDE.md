# Project conventions

## What this project is

`patties` is a Bun-native full-stack meta-framework. The runtime is Bun (not
Node), HTTP comes from `Bun.serve`, bundling from `Bun.build`, filesystem
discovery from `Bun.Glob`. UI is React 19 via `renderToReadableStream`. Build
targets are `bun` and `edge`.

This repo is a Bun workspace monorepo with two packages:

- [`packages/patties`](packages/patties/CLAUDE.md) — the framework itself
- [`packages/create-patties`](packages/create-patties/CLAUDE.md) — the official scaffolder

Read the package-level `CLAUDE.md` for the package you're touching. The notes
below apply to the whole repo.

## Lint / typecheck

- Formatter and linter: **Biome** (`biome.json` at repo root).
- Typecheck: `bun run typecheck` (`tsc --noEmit`, runs across all workspace packages).
- A `PostToolUse` hook (`.claude/hooks/biome-check.sh`) runs `biome check <file>` plus `tsc --noEmit` after every `Edit`/`Write`/`MultiEdit`. The turn is blocked until both pass — fix the reported issues before moving on.
- Aggregate check: `bun run check` (biome + tsc). Full gate: `bun run validate` (lint + typecheck + test + knip).

## Boy-scout mode

When you touch a file, leave it cleaner than you found it:

- **Fix every Biome diagnostic in any file you edit**, even ones unrelated to your task — warnings and errors alike. Don't whitelist or `// biome-ignore` your way out unless there is a real reason (note it in a one-line comment).
- If `tsc --noEmit` surfaces a TypeScript error in a file you touched, fix it before claiming the task done.
- Don't expand scope into untouched files just to clean them — boy-scout applies to files already in your diff.

## Tooling

- Runtime: Bun. Use `bun` / `bunx` rather than `node` / `npx`.
- Tests: `bun test` (do not introduce Jest/Vitest).
- Don't add comments that just describe what the code does. Only note WHY when non-obvious.

## Architectural rules

- **Bun-native first.** Do not pull in `chokidar`, a Node `http` server, Webpack, or Vite. Prefer `Bun.serve`, `Bun.Glob`, `Bun.build`, `bun --hot` / `bun --watch`.
- **Standards at the boundary.** Handlers receive standard `Request` and return standard `Response`. The framework adds `PattiesContext` (params, cookies, env, vars, `json/html/redirect`) — keep it thin.
- **Do expensive thinking at build time.** Route + island discovery happens during `build`; the production server bundle must not re-scan the filesystem at runtime. Tests assert this — don't regress it.
- **Adapters, not vendor lock-in.** Deployment targets (`bun`, `edge`) live in `src/adapters/`. Keep platform specifics out of the framework core.
- **AI features are optional.** `@anthropic-ai/sdk` is an optional peer dep — code under `src/ai/` must not be required to import or instantiate it at module load for non-AI users.
- **Single React copy.** `patties dev` re-execs with `--preserve-symlinks` and prefers the user-project bin path, because linked installs can otherwise resolve a second React from the framework's `node_modules` and crash SSR hooks.

## Agent manifest (`CLAUDE.md` / `AGENTS.md`)

`patties dev` and `patties build` regenerate an inventory of routes,
islands, agents, tools, jobs, middleware, and env vars from the user's app.
By default the inventory is written to `CLAUDE.md`, fenced between
`<!-- patties:manifest-start -->` … `<!-- patties:manifest-end -->`. Anything
outside the markers is preserved across regenerations — so rules and notes
above the section survive. Users override the target via
`config.agentsMd.path` (string or `string[]`) in `patties.config.ts`.

In this repo, the framework workspace's manifest lives in
[`packages/patties/CLAUDE.md`](packages/patties/CLAUDE.md), generated from
`tests/fixtures/ai-app`. CI fails on drift; regenerate with
`bun --filter patties generate:agents-md`.
