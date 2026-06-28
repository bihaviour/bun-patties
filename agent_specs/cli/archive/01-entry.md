---
spec: cli/01-entry
title: Entry & Dispatch
status: completed
phase: 0
file: bin/patties.ts
last_reviewed: 2026-05-23
---

# CLI Spec 01 — Entry & Dispatch

## Purpose

The shebang'd executable that `package.json#bin` points at. Parses `argv`, picks a command handler, and exits with the handler's return code.

## Shape

```ts
#!/usr/bin/env bun

import { run } from "../cli/index.ts"

run(Bun.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (err) => { /* see 07-logging-errors.md */ process.exit(1) }
)
```

## Dispatch table

| Argument | Handler |
|---|---|
| `dev` | `cli/commands/dev.ts` |
| `build` | `cli/commands/build.ts` |
| `deploy` | `cli/commands/deploy.ts` |
| `secret` | `cli/commands/secret.ts` |
| `--version`, `-v` | print version from `package.json`, exit 0 |
| `--help`, `-h`, `help`, no args | print usage, exit 0 |
| unknown | print usage + the unknown token, exit 2 |

## Flag parsing

- Use a tiny hand-rolled parser. No `commander`, no `yargs`.
- Global flags: `--cwd <path>` (default `process.cwd()`), `--config <path>` (overrides discovery), `--verbose`.
- Command-specific flags live in each command's spec.

## Cwd handling

Resolve `--cwd` to an absolute path early. All later file lookups (config, app dir, output) treat that path as the root. Never read from `process.cwd()` after this point.

## Acceptance criteria

- `patties` with no args prints usage and exits 0.
- `patties --version` prints the version on stdout.
- `patties frobnicate` exits 2 with "unknown command: frobnicate" plus usage.
- `patties dev --cwd /tmp/app` operates on `/tmp/app`, ignoring `process.cwd()`.
