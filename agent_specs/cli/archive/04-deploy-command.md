---
spec: cli/04-deploy-command
title: patties deploy
status: completed
phase: 2
file: cli/commands/deploy.ts
last_reviewed: 2026-05-24
---

# CLI Spec 04 — `patties deploy`

## Purpose

Take a built Patties app and push it to the configured host. The framework core is vendor-neutral — the actual deploy step is owned by an installed **deploy plugin** ([framework 09-plugins](../../framework/draft/phase-4/09-plugins.md)). `patties deploy` is dispatch + ergonomics; the plugin does the upload.

## Usage

```
patties deploy [--target bun|edge] [--env production|staging|<name>]
               [--skip-build] [--cwd <path>] [--config <path>]
```

## Behavior

1. Load config ([06](./06-config-loading.md)). `--target` overrides `config.target`.
2. Unless `--skip-build`, run `patties build` ([03](./03-build-command.md)) for the same target.
3. Find the deploy plugin for the configured `target` by scanning `config.plugins` for the first one that declares a matching `deployTarget`. If none is installed, print remediation and exit 2:
   ```
   ✗ No deploy plugin installed for target "edge".
     Install one of:
       bun add @patties/deploy-cloudflare
       bun add @patties/deploy-vercel
       bun add @patties/deploy-deno
       bun add @patties/deploy-netlify
     Or write your own — see framework spec 09-plugins.
   ```
4. Run the plugin's `deploy(artifacts, ctx)` step. The plugin owns:
   - Vendor auth verification (e.g. `wrangler whoami`, `vercel whoami`).
   - Shell-outs via `Bun.$` to the vendor CLI.
   - Capturing and returning the deployed URL.
5. Print the URL as the last line of output (whatever the plugin returns).
6. **Bun target with no deploy plugin**: print the run command (`bun dist/server.js`) and exit 0. Self-hosted deploys are the user's choice of process supervisor (systemd, Docker, fly.io, etc.). The optional `@patties/deploy-bun` packages a Dockerfile / systemd unit.

## Multi-plugin behavior

If multiple deploy plugins are installed for the same target, `--env <name>` selects between them by matching the plugin's `name`. Without `--env`, the first plugin in declared order wins, with a warning.

## Output

```
✓ built  (4.2s)
✓ deploy-cloudflare: wrangler deploy
✓ live at https://my-app.workers.dev
```

## Acceptance criteria

- `patties deploy` in a freshly-scaffolded `--target edge` app with `@patties/deploy-cloudflare` installed yields a working `workers.dev` URL.
- `patties deploy` with no deploy plugin installed exits 2 with the install-this-package message — no stack trace.
- Vendor auth missing produces an actionable error (the plugin's responsibility, the framework just propagates the exit code).
- `--skip-build` reuses the prior `dist/` if present; aborts with a clear error if not.
- The framework core has zero `wrangler` / `vercel` / `deployctl` / `netlify` references in this code path — all shell-outs originate inside plugins via `Bun.$`.
