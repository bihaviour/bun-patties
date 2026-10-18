---
spec: cli/00-overview
title: Patties CLI — Overview
status: completed
phase: all
last_reviewed: 2026-05-23
source: patties-oss-guide.docx
---

# Patties CLI — Draft Overview

## Mission

`patties` is the single command-line entry point developers use to work with a Patties project. Three verbs cover the daily loop — `dev`, `build`, `deploy` — plus a dev-only `secret` for keychain-stored credentials. A separate scaffolder `create-patties` produces a new project. Nothing else ships in the CLI until a real workflow demands it.

## Design pillars

1. **One command, zero questions** — `bun dev` (which calls `patties dev`) must work in a fresh project with no flags.
2. **Bun-native** — invoked via `bun bin/patties.ts`. The CLI itself uses `Bun.spawn`, `Bun.file`, `Bun.argv`.
3. **Fast feedback** — startup under 200ms. No top-level network calls.
4. **Honest output** — surface errors with file + line, suggest the next action.

## Commands

| Command | Spec |
|---|---|
| `patties dev` | [02-dev-command](./02-dev-command.md) |
| `patties build` | [03-build-command](./03-build-command.md) |
| `patties deploy` | [04-deploy-command](./04-deploy-command.md) |
| `patties secret` | [08-secret-command](./08-secret-command.md) |
| `bunx create-patties <name>` | [05-create-patties](./05-create-patties.md) → [09-create-patties-dx](./09-create-patties-dx.md) → redesigned by [18-create-patties-redesign](../draft/18-create-patties-redesign.md) |
| `/patties` skill · `/patties-init` flow | [19-patties-agent-skill](../draft/19-patties-agent-skill.md) |
| `patties add @shadcn/<name>` · `ui init --shadcn` · `create-patties --ui shadcn` | [21-shadcn-registry](./21-shadcn-registry.md) |

## Supporting specs

- [01-entry](./01-entry.md) — `bin/patties.ts` dispatch.
- [06-config-loading](./06-config-loading.md) — how every command finds and loads `patties.config.ts`.
- [07-logging-errors](./07-logging-errors.md) — output conventions, diagnostics, exit codes.

## Phase alignment

- Phase 0: entry, `dev`, scaffolder seed.
- Phase 1: `build`, `secret`.
- Phase 2: `deploy`.
- Phase 3+: no new commands; existing commands generate `AGENTS.md` automatically.
- Dev-DX (post-launch): 09 — overhauls `create-patties` (template, README, prompts, agent overlays, name handling).
- Dev-DX (post-launch): 18 — redesigns the `create-patties` prompt flow (agent → type → UI/monorepo → deploy target) and hands off to the agent for feature scaffolding; 19 — the `/patties` skill (components + agent-only pattern modules) and the `/patties-init` plan-mode onboarding flow.

## Non-goals

- An interactive REPL.
- A plugin-extensible command surface (plugins extend the framework, not the CLI). Revisit via RFC if user demand appears.
