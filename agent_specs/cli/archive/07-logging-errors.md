---
spec: cli/07-logging-errors
title: Logging, Errors, Exit Codes
status: completed
phase: all
file: cli/log.ts
last_reviewed: 2026-05-23
---

# CLI Spec 07 — Logging, Errors, Exit Codes

## Purpose

Make the CLI's output predictable and useful — for humans, for CI logs, and for agents reading transcripts.

## Streams

- **stdout** — primary output: build summaries, ready-banners, deploy URLs. Machine-parseable when `--json` is added later.
- **stderr** — diagnostics: warnings, errors, the trailing stack trace on `--verbose`.

## Verbosity

- Default: one ready/summary line plus per-request logs (dev) or per-step ticks (build/deploy).
- `--verbose`: include resolved config, file lists, full stack traces.
- `--silent` (future): suppress everything except errors.

## Colors

- ANSI color when `stdout` is a TTY and `NO_COLOR` is unset.
- Conventions:
  - Green ✓ for success ticks.
  - Yellow ⚠ for warnings.
  - Red ✗ for errors.
  - Dim for timing / metadata.

## Error format

```
✗ Build failed
  File: app/routes/index.tsx:14:8
  Reason: Cannot find name 'usState'. Did you mean 'useState'?
  → Tip: import { useState } from "react"
```

Three required parts: what failed, where, and a tip when possible. Stacks belong behind `--verbose`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Build / runtime error (user-facing) |
| 2 | CLI usage error (unknown command, bad flag, missing config when explicitly requested) |
| 130 | Interrupted (SIGINT) |

## Telemetry

- None in the draft. Any future telemetry requires an RFC and an opt-in flag — never opt-out.

## Acceptance criteria

- A user typo in a route file produces a single block matching the error format above.
- Piping `patties build` into a non-TTY removes color codes from output.
- `patties dev` interrupted with Ctrl-C exits with code 130.
