---
rfc: bun-secrets
title: Bun.secrets — OS keychain-backed dev secrets
status: encoded
encoded_in: ["framework/phase-2/08-config", "cli/08-secret-command"]
encoded_on: 2026-05-24
verdict: accept-dev-only
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 1
affects_specs: [08-config, 13-conventions, 15-claude-code-scaffold]
---

## Review verdict (2026-05-24)

**Accept, scoped tightly to dev.** Resolves the "where do my dev secrets live" gap in spec 08.

Scope pins:
- **Source order in dev**: `Bun.secrets` > `Bun.env`. A key present in both wins via `Bun.secrets`.
- **Source order in prod** (`PATTIES_ENV=prod` or `NODE_ENV=production`): `Bun.secrets` is bypassed entirely. Only runtime-injected `Bun.env` / vendor bindings are read.
- **Linux without libsecret**: a missing keychain backend logs a one-line warning at boot and silently falls through to `Bun.env`. Not a boot error — CI on bare Linux must keep working.
- **Service name** (open question): use `package.json#name` if present, else `"patties"`. Pin this so dev secrets are per-project, not shared across all Patties apps on the dev box.

CLI surface (`patties secret set <key>` etc.) is encoded into CLI specs separately.

---

# RFC — Bun.secrets integration

## Summary
`Bun.secrets.get(service)` / `.set(service, value)` reads and writes credentials via the OS keychain (macOS Keychain, Windows Credential Manager, libsecret on Linux). Patties should support `Bun.secrets` as an alternative source for dev-time secrets, so `.env.local` is no longer the only path and contributors don't accidentally commit credentials.

## Motivation
08-config validates env vars at boot but offers no recommendation for *where* secrets live in development. Today every contributor either keeps `.env.local` (commit risk) or pastes secrets into their shell. `Bun.secrets` is zero-dep, OS-integrated, and never touches disk in the repo.

## Proposal
- 08-config: add a `secrets:` field to the config schema that lists keys to load from `Bun.secrets` at boot:
  ```ts
  export default defineConfig({
    secrets: ["ANTHROPIC_API_KEY", "DATABASE_URL"],
  });
  ```
  These overlay `Bun.env` at boot; missing entries fall back to `Bun.env`.
- 15-scaffold: `patties secret set <key>` writes via `Bun.secrets.set`.
- 13-conventions: in production (NODE_ENV=production or PATTIES_ENV=prod), `Bun.secrets` is bypassed — only `Bun.env` (vendor-injected) is read.

## Trade-offs
- Linux CI without libsecret will fail — must gate on dev-only.
- Encourages "set once, forget" — rotation is harder than editing `.env`.

## Open questions
- Service name: hardcode `"patties"` or derive from `package.json#name`?
- Do we want a `patties doctor` command (15) that lists which keys are sourced from where?
