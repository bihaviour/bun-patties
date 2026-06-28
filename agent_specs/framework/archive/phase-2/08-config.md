---
spec: framework/08-config
title: Config
status: draft
phase: 2
file: patties.config.ts (user) · loader in framework
last_reviewed: 2026-05-23
---

# Spec 08 — Config

## Purpose

Single configuration file for a Patties project. Optional — sensible defaults must work without it.

## User contract

```ts
// patties.config.ts
import { defineConfig } from "patties/config"

export default defineConfig({
  target: "edge",              // "bun" | "edge" — default "bun". "edge" emits a portable Worker module.
  appDir: "./app",             // default "./app"
  outDir: "./.patties",        // default "./.patties"
  plugins: [],                 // see 09-plugins.md
  env: {
    required: ["DATABASE_URL"],
    public: ["PUBLIC_*"]       // names exposed to the client bundle
  },
  secrets: ["ANTHROPIC_API_KEY", "DATABASE_URL"],   // loaded from Bun.secrets in dev (rfc-bun-secrets)
  server: {
    port: 3000,
    hostname: "0.0.0.0"
  }
})
```

## Loader behavior

1. Look for `patties.config.ts`, `.js`, or `.mjs` in the project root.
2. Import via Bun's native TS support.
3. Validate with a Zod schema; produce a normalized config with all defaults filled in.
4. If the file is missing, return defaults.
5. Surface validation errors with the field path and the offending value.

## Edge target validation

When `target === "edge"`, the loader cross-checks that no plugin or app code imports `node:*` modules without a Workers-runtime polyfill mapping. Failures are diagnostics, not warnings. This applies regardless of which vendor will host the artifact (Cloudflare, Deno Deploy, Vercel Edge, Netlify Edge, etc.) — the check is against the WinterCG / `workerd` runtime surface, not against any vendor's bindings.

## Env validation

`env.required` is validated at **boot time only** — inside `startServer` (Bun) and at the Worker's first `fetch` (edge target, any vendor). The build step deliberately does not read or validate env vars, so CI can build artifacts without holding production secrets.

- On boot, every name in `env.required` must resolve to a non-empty value via the framework's `getEnv(name)` lookup. The lookup is adapter-aware:
  - **Bun target**: reads from `Bun.env` (typed wrapper around `process.env`, faster than `process.env` access on hot paths).
  - **Edge target**: reads from the runtime-provided bindings object (Cloudflare's `env`, Deno's `Deno.env.toObject()`, Vercel/Netlify edge `process.env`, etc.), normalized by the adapter.
  Missing names throw a single `MissingEnv` error listing all of them.
- Names in `env.public` are inlined into the client bundle at build time (`Bun.build` define). They are not checked for presence — absent public vars become the empty string in the bundle.
- No lazy / first-access validation: a typo in `env.required` should fail at boot, not at 3am during a request.

## Dev secrets via `Bun.secrets`

`config.secrets: string[]` lists keys to source from the OS keychain in development via `Bun.secrets.get(serviceName, key)`. Source order:

- **Dev** (`PATTIES_ENV !== "production"`): for each key, try `Bun.secrets.get(serviceName, key)` first; fall back to `Bun.env[key]` if absent. The keychain value wins on conflict.
- **Production** (`PATTIES_ENV === "production"` or `NODE_ENV === "production"`): `Bun.secrets` is bypassed entirely. Only `Bun.env` / vendor-injected bindings are read. The framework never speaks to the keychain in prod.

`serviceName` defaults to `package.json#name` if present, else `"patties"` — so dev secrets are per-project, not shared across all Patties apps on the dev box.

**Linux without libsecret**: a missing keychain backend logs a one-line warning at boot and silently falls through to `Bun.env`. Not a boot error — CI on bare Linux must keep working. See [[rfc-bun-secrets]].

CLI: `patties secret set <key>` (writes via `Bun.secrets.set`). See CLI specs.

## Acceptance criteria

- Missing config → framework boots with defaults.
- Invalid `target: "node"` → loader throws naming the field and the allowed values (`bun`, `edge`).
- `defineConfig` returns its argument unchanged (it exists for typing).
- Booting with `env.required: ["DATABASE_URL"]` and no `DATABASE_URL` set throws `MissingEnv: DATABASE_URL` *before* `Bun.serve` binds a port.
- `patties build` succeeds in an environment with none of the `env.required` values set.
