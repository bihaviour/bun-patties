---
spec: framework/05-dev-hmr
title: Dev / HMR
status: done
phase: 1
file: dev/watcher.ts
last_reviewed: 2026-05-24
---

# Spec 05 — Dev / HMR

## Purpose

Provide the dev-time feedback loop: reload changed modules in place and tell connected browsers to refresh. The dev runner is **`bun --hot`** by default (state-preserving, keeps WebSockets alive across reloads); `bun --watch` is opt-in via `patties dev --cold` for the rare "I want a clean process every save" case. The wake-up signal to the browser is a WebSocket.

## Public surface

```ts
export interface DevServer {
  fetch: (req: Request) => Response | Promise<Response>
  websocket: WebSocketHandler
  notifyChange(path: string): void
}

export function createDevServer(options: DevOptions): DevServer
```

## Behavior

1. The CLI's `patties dev` runs the process under **`bun --hot`** so modules reload in place — no `fs.watch`, no `chokidar`, no process restart. The same `Bun.serve` instance keeps running across reloads; existing WebSocket connections survive.
2. On boot, mount a WebSocket endpoint at `/__patties_hmr`. Each connected browser calls `ws.subscribe("hmr")` on `open`. The server holds no manual `Set<ServerWebSocket>` — Bun's native **WebSocket pub/sub topics** manage the subscriber list, and dead sockets are removed automatically on close.
3. The dev server registers `import.meta.hot.accept(() => server.publish("hmr", ...))` so that whenever Bun finishes a hot module reload, the connected browsers receive the appropriate `reload` or `update` message — without any WebSocket teardown.
4. For islands, publish `{ type: "update", island: "<name>" }` on topic `"hmr"` when the changed file lives under `app/islands/`. The client may re-hydrate that island only.
5. For everything else, publish `{ type: "reload" }` and let the page do a full refresh.
6. Macro inputs (route files, `env.public`, island manifest sources — see [04-build](./04-build.md)) re-run their macros on `--hot` reload. If a change touches a path Bun's dep tracker doesn't follow, the dev server falls back to a full refresh; document the affected paths in the dev log.
7. **`patties dev --cold`** opts into `bun --watch` (full process restart) instead. Useful when modules carry init-only state that doesn't reload cleanly. The HMR client's reconnect path (below) handles the WebSocket teardown.

## Client snippet

Injected by [03-render](../phase-0/03-render.md) in dev mode. ~30 lines: opens the WebSocket and dispatches `reload` / `update` messages from the server.

### Reconnect behavior

Under the default `bun --hot`, the WebSocket survives reloads and reconnect logic rarely fires. Under `patties dev --cold` (`bun --watch`), the server process restarts and all WebSockets close — the reconnect path below is the recovery mechanism.

- On `close`, the client retries `/__patties_hmr` with exponential backoff: starts at 250 ms, doubles each attempt, capped at 5 s.
- Backoff resets to 250 ms on each successful open.
- On successful (re)open the *server* immediately sends `{ type: "reload" }` so the page reflects the new build. The client does **not** decide to reload on reconnect; it waits for the server signal so a transient connection blip doesn't trigger a reload.
- If the reconnect attempt is refused (server still booting), the client keeps retrying silently — no console noise until 5 consecutive failures, then one warning.

## Dev error pages

When a page module throws during import or render, the renderer ([03](../phase-0/03-render.md)) returns a styled HTML error page instead of letting the process crash. The HMR client snippet on that page stays connected, so the next save reloads it once the user fixes the error.

## Non-goals

- React Fast Refresh — not used; we use coarse-grained island re-hydration.
- File watching ourselves — Bun handles it.

## Acceptance criteria

- Editing `app/routes/index.tsx` reloads the open browser within ~500ms.
- Editing `app/islands/counter.tsx` re-hydrates the counter without a full reload (best-effort; full reload is acceptable fallback).
- Killing the dev server and starting a new one causes the browser to reconnect and reload automatically.
