---
rfc: bun-cron
title: Bun.cron — first-class scheduled jobs convention
status: encoded
encoded_in: ["framework/phase-3/10-agents-and-tools", "framework/phase-4/09-plugins"]
encoded_on: 2026-05-24
verdict: accept
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 2
affects_specs: [01-server, 10-agents-and-tools, 13-conventions, 09-plugins]
---

## Review verdict (2026-05-24)

**Accept.** `app/jobs/` is the natural parallel to `app/agents/` and `app/tools/` — closes the gap where spec 10 mentions cron callers without defining them.

Scope adjustments:
- **Singleton across replicas**: deferred to Phase 3. Phase 2 ships without it — multi-instance deploys fire each job N times. Documented loudly. The `singleton: true + Redis` mechanism becomes a follow-up RFC once `@patties/cache` (using `Bun.RedisClient`) lands.
- **Edge-target cron**: moved out of spec 12 and into **deploy plugins**. `@patties/deploy-cloudflare` translates `app/jobs/*` into `wrangler.toml [triggers]`; `@patties/deploy-vercel` emits `vercel.json crons`; etc. The framework core stays neutral — it just exposes the job inventory to plugins via a build hook.
- **Tests**: cron handler unit tests invoke the exported default function directly with a mocked `AiContext` (no need to fake the clock; that's the scheduler's job, not the handler's).

---

# RFC — Bun.cron integration

## Summary
Bun ships `Bun.cron(expr, handler)` returning a `Bun.CronController` with `.stop()` and `.list()`. Patties should adopt a `app/jobs/**/*.ts` convention where each file exports a default handler and a `schedule` string; the server wires them through `Bun.cron` on boot.

## Motivation
10-agents-and-tools mentions "cron jobs" as a call site for `createAiContext` but no spec actually defines how cron is declared, wired, or tested. Users currently have no answer for "where does a recurring task live in a Patties app?" Bun's native cron removes the need for `node-cron`, `croner`, or external schedulers, and integrates with the same process lifecycle as `Bun.serve`.

## Proposal
- 13-conventions: introduce `app/jobs/` convention with file shape:
  ```ts
  export const schedule = "*/5 * * * *";
  export default async (ctx: JobContext) => { /* ... */ };
  ```
- 01-server: on boot, scan `app/jobs/` via `Bun.Glob`, register each via `Bun.cron(schedule, handler)`, retain the `CronController` for graceful shutdown.
- 10-agents-and-tools: cron handlers receive an `AiContext` created via `createAiContext` — same shape as request handlers.
- 09-plugins: deploy plugins consume the `app/jobs/*` inventory via a build hook and emit vendor-native cron triggers (`wrangler.toml [triggers]`, `vercel.json crons`, Deno Deploy queued tasks, etc.). The framework core stays vendor-neutral.

## Trade-offs
- Multi-instance deploys (reusePort, edge replicas) will fire each job N times unless we add a lock. Document this and provide a `singleton: true` option that requires a Redis client.
- Time-zone semantics: `Bun.cron` is process-local TZ; we should require explicit `tz:` in the export.

## Open questions
- Should `schedule` be a single string or `string | string[]`?
- How do tests fake the clock? Bun's mocks (14-testing) don't cover `Bun.cron` directly.
