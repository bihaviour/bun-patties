---
spec: cli/08-secret-command
title: patties secret
status: completed
phase: 1
file: cli/commands/secret.ts
last_reviewed: 2026-05-24
depends_on: [rfc-bun-secrets]
---

# CLI Spec 08 — `patties secret`

## Purpose

Manage dev-time secrets stored in the OS keychain via `Bun.secrets`. This is the developer-facing companion to the `secrets:` config field in [framework 08-config](../../framework/draft/phase-2/08-config.md). Production environments never touch the keychain — they read from `Bun.env` / vendor bindings only.

## Usage

```
patties secret set <key>                  # prompt for value (hidden input)
patties secret set <key> <value>          # set without prompting (avoid in shell history)
patties secret get <key>                  # print value to stdout (TTY-only by default)
patties secret list                       # list keys (values masked)
patties secret rm  <key>                  # delete from the keychain
patties secret doctor                     # show source of every key in config.secrets
```

## Behavior

1. Resolve the **service name** for `Bun.secrets`: `package.json#name` if present, else `"patties"`. So dev secrets are per-project, not shared across all Patties apps on the dev box.
2. `set` — `await Bun.secrets.set(serviceName, key, value)`. If no value argument is provided and stdin is a TTY, prompt with hidden input (`Bun.stdin` + raw mode); otherwise read one line from stdin.
3. `get` — `await Bun.secrets.get(serviceName, key)`. Refuses to print to a non-TTY stdout unless `--force` is passed (avoids accidental log/CI capture). Returns exit 1 if the key is unset.
4. `list` — enumerates keys for the service. Values shown as `••••` plus the last 4 characters when length ≥ 8; otherwise just `••••`.
5. `rm` — deletes the key. Idempotent; missing keys exit 0 with a one-line note.
6. `doctor` — for each key in `config.secrets`, show its source: `keychain` / `Bun.env` / `missing`. Useful when "but I thought I set it" debugging.

## Linux / libsecret

If the platform has no keychain backend (Linux without libsecret, some CI containers), every command except `doctor` exits 2 with a one-line install hint (`sudo apt install libsecret-1-dev` on Debian-likes). `doctor` still runs — it just reports `Bun.env` or `missing` for every key.

## Production guard

In `PATTIES_ENV=production` (or `NODE_ENV=production`), all `patties secret` subcommands exit 2 with:

```
✗ patties secret is a dev-only tool. In production, set values via your host's secrets surface.
```

This prevents accidental "I'll just set the prod DB URL on the dev box" patterns.

## Output examples

```
$ patties secret set ANTHROPIC_API_KEY
value: ************ (hidden)
✓ stored ANTHROPIC_API_KEY (service: my-app)

$ patties secret doctor
  ANTHROPIC_API_KEY    keychain
  DATABASE_URL         Bun.env
  STRIPE_KEY           missing
```

## Acceptance criteria

- `patties secret set FOO bar && patties secret get FOO` returns `bar` on macOS / Windows / Linux-with-libsecret.
- `patties secret get FOO > /tmp/out` (non-TTY stdout) refuses without `--force`.
- `patties secret list` masks values; full values never appear except via `get`.
- On Linux without libsecret, `patties secret doctor` still runs and reports correctly.
- In `PATTIES_ENV=production`, every subcommand except `doctor` (which is read-only) exits 2 with the dev-only message.
