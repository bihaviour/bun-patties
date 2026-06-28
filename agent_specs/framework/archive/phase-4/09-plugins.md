---
spec: framework/09-plugins
title: Plugins
status: completed
phase: 4
file: plugins/index.ts
last_reviewed: 2026-05-23
---

# Spec 09 — Plugins

## Purpose

Allow third parties to extend Patties without forking. The contract is small on purpose: plugins receive a small route-registration API and a set of hooks; they cannot redefine the runtime.

## Public surface

```ts
export interface PluginServer {
  /** Register a route into the framework's compiled routes map. Wrapped by user middleware. */
  route(pattern: string, methods: Record<string, Handler>): void
  /** Add a middleware that runs after user middleware, before plugin/filesystem handlers. */
  use(middleware: Middleware): void
}

export interface Plugin {
  name: string
  /** Semver range of framework versions this plugin supports. Verified via Bun.semver at registration. */
  compat?: string                          // e.g. "^1.0.0"
  setup(server: PluginServer, ctx: PluginContext): void | Promise<void>
  hooks?: {
    onBuildStart?(opts: BuildOptions): void | Promise<void>
    onBuildEnd?(result: BuildResult): void | Promise<void>
    onDevStart?(server: DevServer): void | Promise<void>
    onAgentsMdGenerate?(doc: AgentsMdDocument): AgentsMdDocument | Promise<AgentsMdDocument>
    /** Receives the inventory of `app/jobs/*` for deploy plugins to translate into vendor cron triggers. See rfc-bun-cron. */
    onJobsCollect?(jobs: JobSummary[]): void | Promise<void>
  }
}

export function definePlugin(p: Plugin): Plugin
```

`PluginContext` exposes the resolved config, the project root, and a logger. Note: plugins do not receive a Hono app — there is no Hono. Route registration goes through `server.route()`, which folds entries into the same `routes:` map [01-server](../phase-0/01-server.md) passes to `Bun.serve`.

### Compat checks

At plugin registration the framework calls `Bun.semver.satisfies(frameworkVersion, plugin.compat)` when `compat` is set. A mismatch fails boot with both versions and the plugin name. Plugins without `compat` are allowed but log a one-line warning at boot — pinning is encouraged.

## Behavior

1. The framework iterates `config.plugins` in declared order.
2. For each plugin, call `setup(server, ctx)` **after user middleware is wired and before filesystem routes are registered**. This is the fixed wiring order from [02-router](../phase-0/02-router.md): `user middleware → plugins → routes`. Consequences:
   - Plugin-mounted routes are wrapped by user middleware (auth, logging, etc.) just like filesystem routes.
   - A plugin that registers `server.route("/__health", { GET: ... })` will be hit by user middleware. Plugins wanting to opt out should mount under a reserved path the user's middleware excludes.
3. Hooks fire at the documented points. Errors abort the operation with the plugin name in the trace.

## Official plugins (roadmap)

Capability plugins (vendor-agnostic, sit above storage / auth / email APIs). Where Bun ships a built-in, the official plugin uses it by default to avoid peer-dep weight on the edge bundle:

- `@patties/auth` — password hashing via **`Bun.password`** (argon2id by default; bcrypt opt-in). No `bcryptjs` / `argon2` peer dep.
- `@patties/database` — default driver is **`bun:sqlite`** for local/SQLite, **`Bun.sql`** for Postgres. Drivers for other engines are opt-in subpackages.
- `@patties/cache` — sessions and cache via **`Bun.RedisClient`**. No `ioredis` peer dep.
- `@patties/storage` — object storage via **`Bun.S3Client`** (works with AWS S3, Cloudflare R2, MinIO, Backblaze B2 — anything S3-compatible). No `@aws-sdk/client-s3` peer dep.
- `@patties/analytics`
- `@patties/email`
- `@patties/shadcn` — Tailwind + shadcn/ui preset for the React island stack.

Choosing Bun built-ins isn't dogma — it's bundle size. Each peer-dep avoided is bytes shaved off cold start on the `edge` target.

Deploy plugins (one per edge host — own their own vendor config, the framework core stays neutral):

- `@patties/deploy-cloudflare` — emits `wrangler.toml`, runs `wrangler deploy`.
- `@patties/deploy-vercel` — emits `vercel.json` for Vercel Edge Functions.
- `@patties/deploy-deno` — emits config for Deno Deploy.
- `@patties/deploy-netlify` — emits `netlify.toml` for Netlify Edge.
- `@patties/deploy-bun` — packages a Bun-target build for a self-hosted VPS.

A deploy plugin's job is to consume the portable Worker module from [12-edge-adapters](../phase-2/12-edge-adapters.md) and produce vendor-specific artifacts + a `patties deploy` action. Anyone can write a new deploy plugin without touching the framework.

Deploy plugins shell out via **`Bun.$`** (Bun Shell) — typed, cross-platform, no `node:child_process`. Example: `await Bun.$\`bunx wrangler deploy ${file}\`.cwd(outDir)`.

## Non-goals

- Loader/transformer plugins (`Bun.build` plugins handle that domain — re-exposed if needed via RFC).
- Plugin-to-plugin dependency resolution.

## Acceptance criteria

- A plugin that calls `server.route("/__health", { GET: () => new Response("ok") })` makes that route reachable.
- Throwing in `setup` aborts boot with a message naming the plugin.
- Plugins run in declared order (verifiable by ordered log lines).
