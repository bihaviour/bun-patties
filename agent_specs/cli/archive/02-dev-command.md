---
spec: cli/02-dev-command
title: patties dev
status: completed
phase: 0-1
file: cli/commands/dev.ts
last_reviewed: 2026-05-23
notes: Phase 0 boots the server; Phase 1 adds HMR.
---

# CLI Spec 02 — `patties dev`

## Purpose

Start the local development server with hot reload, ready to use in one command.

## Usage

```
patties dev [--port <n>] [--host <h>] [--cold] [--cwd <path>] [--config <path>]
```

## Behavior

1. Load the resolved config ([06](./06-config-loading.md)).
2. Re-exec the dev runner under **`bun --hot`** (the default) — modules reload in place, `Bun.serve` is reused across reloads, and existing WebSockets survive. See framework spec [05-dev-hmr](../../framework/draft/phase-1/05-dev-hmr.md). The first invocation detects whether it is already the hot child via an env flag (e.g. `PATTIES_DEV_HOT=1`) to avoid an infinite re-exec loop.
   - `--cold` opts into `bun --watch` instead (full process restart on each save). Useful when modules carry init-only state that doesn't reload cleanly.
3. Build (incremental) the client bundle once at start; subsequent reloads reuse cached chunks where possible.
4. Compile routes (framework [02](../../framework/draft/phase-0/02-router.md)) and start the server with `dev: true` (framework [01](../../framework/draft/phase-0/01-server.md)). Routing goes through `Bun.serve({ routes })` — no HTTP framework is loaded.
5. Print: `▲ Patties dev ready at http://<host>:<port>` and the project root.
6. Forward `SIGINT` / `SIGTERM` to shut down cleanly.

## Flags

- `--port` — default from config, else `3000`.
- `--host` — default from config, else `0.0.0.0`.
- `--cold` — use `bun --watch` (process restart) instead of `bun --hot`.
- `--no-open` — reserved for future browser-open behavior; no-op today.

## Output

- One header line on boot.
- Each request: `→ GET /hotels/bali  200  12ms` (color when TTY).
- On error: stack with source mapped back to the user's file when possible.

## Acceptance criteria

- `patties dev` in a fresh `bunx create-patties` project starts a server on `http://localhost:3000` rendering the seed page.
- Editing `app/routes/index.tsx` causes the browser to reload within ~500ms.
- Ctrl-C exits with code 0 and no orphaned processes.
- An error in a route file prints a usable diagnostic and keeps the server up.
