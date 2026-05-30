# `create-patties` package conventions

The official scaffolder. `bunx create-patties@latest my-app` copies a template
into a new directory, patches `package.json`/`patties.config.ts`, applies the
chosen agent overlay (Claude / Codex / none), and optionally initializes git
and runs `bun install`.

Project-wide rules live in `../../CLAUDE.md`. Read those first.

## Source layout

- `bin/create-patties.ts` — CLI entry; argv parsing handled in `src/index.ts`
- `src/index.ts` — main entry point. `scaffold(args)` orchestrates: validate
  args → copy `templates/default/` → patch package.json + patties.config.ts →
  apply agent overlay → run probes (git, bun install) → print next-steps
- `src/prompts.ts` — interactive prompts when args are missing
- `src/probes.ts` — environment checks (git available, bun version, etc.)
- `src/readme.ts` — renders the project README from `README-template.md`

## Templates

- `templates/default/` — the base scaffold every project starts from:
  `app/routes/`, `app/islands/`, `app/server.ts`, `patties.config.ts`,
  `tsconfig.json`, `gitignore`, `README-template.md`.
- `templates/_claude/` — overlay applied for `--template claude` (default).
  Drops in `.claude/` (rules, commands, agents, hooks) and a project
  `CLAUDE.md` that explains where the rules live.
- `templates/_codex/` — overlay for `--template codex`. Drops in `.codex/`
  and an `AGENTS.md`.

The default app (`templates/default/app/`) uses `setupDevClient` and wraps
`<TodoApp />` in `<Island name="TodoApp">…</Island>` — both are required for
hydration to work, so don't strip them from the demo.

## Tests

`bun test`. The end-to-end test under `tests/create-patties.test.ts` runs
the scaffolder against tmp dirs and asserts the output tree.

## When updating

- Always test that a freshly scaffolded app actually boots: from the tmp
  output, run `bun install && bunx patties dev` and confirm SSR + hydration.
- Keep the next-steps message terse. Prefer `bunx patties dev` over
  `bun dev` so the user sees the CLI they'll be using day-to-day.
