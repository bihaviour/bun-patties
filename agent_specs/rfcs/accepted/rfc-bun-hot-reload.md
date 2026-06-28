---
rfc: bun-hot-reload
title: bun --hot — state-preserving reload as alternative to --watch
status: encoded
encoded_in: ["framework/phase-1/05-dev-hmr", "cli/02-dev-command"]
encoded_on: 2026-05-24
verdict: accept
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 1
affects_specs: [05-dev-hmr, 13-conventions]
---

## Review verdict (2026-05-24)

**Accept.** The most important RFC in this batch — spec 05 was designed around `--watch`'s teardown problem, and `--hot` eliminates the problem rather than working around it. Encoding into spec 05 is straightforward; the WebSocket reconnect logic gets simpler (no more "reconnect on every save" — the WS survives the reload).

Required additions before encoding:
- Add `patties dev --cold` flag for forced clean-process semantics. Default is `--hot`.
- Spec 05's HMR server uses `import.meta.hot.accept(() => server.publish("hmr", ...))` to push updates; the client snippet stays unchanged.
- Smoke test: verify the route-table macro re-runs on `--hot` when a file under `app/routes/` changes. If it doesn't, those changes need a special-case full restart (acceptable fallback). See [[rfc-bun-import-attributes]] for the macro-reload question.

Depends on: the macro policy decided in [[rfc-bun-import-attributes]] (route table is a required macro).

---

# RFC — bun --hot adoption

## Summary
`bun --hot` reloads changed modules *inside the same process* and re-fires `Bun.serve` with the new fetch handler, while preserving live WebSocket connections, in-memory caches, and `bun:sqlite` handles. `bun --watch` (current Patties choice) kills and respawns the process. `--hot` is materially better DX for stateful dev sessions.

## Motivation
05-dev-hmr explicitly notes: "`bun --watch` kills and respawns the server process on every source change, which closes all WebSockets." That breaks every open island demo, every dev WS, and forces the HMR client to reconnect on every save. `bun --hot` solves this directly without any framework code change beyond switching the dev command.

## Proposal
- 05-dev-hmr: change the dev launcher from `bun --watch app/server.ts` to `bun --hot app/server.ts`. The HMR WebSocket no longer needs the reconnect-on-startup signal; instead, the server publishes `{ type: "reload" }` from inside its `import.meta.hot.accept(() => server.publish("hmr", ...))` callback.
- 13-conventions: name `bun --hot` as the canonical dev runner; `bun --watch` is reserved for "I want a clean process every time" cases (e.g. running migrations on boot).

## Trade-offs
- `--hot` retains module-level state — bugs caused by stale closures are easier to hit. Document the gotcha.
- A small set of modules (those with native handles) reload imperfectly; we'll need a fallback "press R to full restart" path.

## Open questions
- Does `--hot` cooperate with the route-table-as-literal-JSON output (08-config) when route files change? Needs a smoke test.
- Should `patties dev` accept `--cold` to opt back into `--watch` semantics?
