# Project conventions

## What this project is

`patties` is a Bun-native full-stack meta-framework. The runtime is Bun (not Node), HTTP comes from `Bun.serve`, bundling from `Bun.build`, filesystem discovery from `Bun.Glob`. UI is React 19 via `renderToReadableStream`. Build targets are `bun` and `edge`.

Public entry points are declared in `package.json#exports` (`patties`, `patties/router`, `patties/render`, `patties/client`, `patties/build`, `patties/dev`, `patties/config`, `patties/middleware`, `patties/server`, `patties/ai`, `patties/agents-md`, `patties/plugin`). The CLI lives at `bin/patties.ts` (`patties dev` / `patties build`).

Source layout under `src/`:

- `router/` — filesystem route scan + compile to Bun route patterns
- `render/` — React SSR + dev error overlay
- `client/` — browser hydration runtime for islands
- `build/` — route + island scan, client/server entry generation, `Bun.build` pipeline
- `dev/` — `bun --hot` / `bun --watch` integration, HMR WebSocket
- `server/` — `startServer` / `createServer` around `Bun.serve`
- `middleware/` — composition, `PattiesContext`
- `config/` — `defineConfig`, env + secrets loading, Zod schemas
- `ai/` — optional agents / tools / jobs primitives (Anthropic SDK is an optional peer dep)
- `agents-md/` — `AGENTS.md` generator
- `plugin/` — plugin system
- `adapters/` — `bun` and `edge` runtime adapters

## Lint / typecheck

- Formatter and linter: **Biome** (`biome.json` at repo root).
- Typecheck: `bun run typecheck` (`tsc --noEmit`).
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
