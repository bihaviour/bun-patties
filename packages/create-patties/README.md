# create-patties

The official scaffolder for [Patties](https://github.com/bihaviour-ai/bun-patties-framework) —
a Bun-native full-stack meta-framework with React 19 rendering.

```sh
bunx create-patties@latest my-app
```

Runs an interactive prompt (project name, agent overlay, demo template,
runtime target, deploy target), then scaffolds, installs, and gets you
to `bunx patties dev` in one shot.

## Options

```sh
bunx create-patties@latest my-app \
  --template claude|codex|none \
  --target   bun|edge \
  --deploy   cloudflare|vercel|deno|netlify|bun|none \
  --blank \
  --git \
  --no-install \
  --yes
```

| Flag | Default | What it does |
|---|---|---|
| `--template` | `claude` | Agent-platform overlay (`claude`, `codex`, or `none`). |
| `--target` | `bun` | Runtime target written into `patties.config.ts`. |
| `--deploy` | `none` | Records the intended deploy target. |
| `--blank` / `--empty` | off | Skip the interactive todo demo; ship a hello-world page. |
| `--git` | off | Run `git init` + initial commit (opt-in). |
| `--no-install` | off | Skip `bun install`. |
| `--yes` / `-y` | off | Accept all defaults; skip prompts. |

`--agent claude-code` is retained as a back-compat alias for
`--template claude`.

## What you get

A minimal Patties app with filesystem routing under `app/routes/`,
optional client islands under `app/islands/`, and either the `_claude`
or `_codex` agent overlay scaffolding conventions for your chosen
coding agent.

See [the Patties docs](https://bun-patties.com) for the full framework
guide.

## Requires

Bun 1.3+. `bunx create-patties@latest` won't work under Node — install
Bun first from [bun.sh](https://bun.sh).
