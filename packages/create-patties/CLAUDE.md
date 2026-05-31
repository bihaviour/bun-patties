# `create-patties` package conventions

The official scaffolder (cli specs 18 + 19). `bunx create-patties@latest my-app`
resolves options (flags → prompts → defaults), copies the base template, shapes
it for the chosen **project type**, patches `package.json`/`patties.config.ts`,
applies the chosen agent overlay (Claude / Codex / none), optionally stamps the
**Patties UI** starter set and restructures into a **monorepo**, then optionally
initializes git and runs `bun install`.

Project-wide rules live in `../../CLAUDE.md`. Read those first.

## Source layout

- `bin/create-patties.ts` — CLI entry; argv parsing handled in `src/index.ts`
- `src/index.ts` — main entry point. `run(argv)` orchestrates: resolve + gate
  options → copy `templates/default/` → `applyProjectType` (prune for
  frontend/backend) → write package.json + patches → apply agent overlay →
  `setupMonorepoRoot` (if `--monorepo`) → `applyUiStarter` (if UI) →
  `applyContainer` (if `--target container`) → render templates → install/git →
  next-steps
- `src/prompts.ts` — gated interactive prompts (agent → type → ui → monorepo →
  target → deploy)
- `src/ui.ts` — stamps the vendored Patties UI starter set; `UI_DEPS` mirror the
  registry peer deps
- `src/probes.ts` — environment checks (git available, bun version, etc.)
- `src/readme.ts` — `applyTemplate` (`{{name}}` etc. + `<!-- if:KEY=VALUE -->`)
- `scripts/gen-patties-skill.ts` — generates the `/patties` skill + Codex rule
  from `templates/_shared/patties-patterns.md` (`--check` for CI drift)

## Templates

- `templates/default/` — full-stack base every project starts from:
  `app/routes/` (incl. `api/health.ts`), `app/islands/`, `app/server.ts`,
  `patties.config.ts`, `tsconfig.json`, `gitignore`, `README-template.md`.
  Frontend prunes `app/routes/api`; backend drops the page+island and adds the
  `_backend` overlay (API only). Don't keep three near-identical trees — prune
  from this one.
- `templates/_backend/` — API sample (`app/routes/api/todos.ts`) for `--type backend`.
- `templates/ui-starter/` — **vendored**, byte-for-byte copies of
  `packages/patties-ui/templates/{button,card,input,label,_internal,tokens.css,themes}`
  plus a UI-flavored demo (`demo/`) + `styles/app.css`. A drift test in
  `tests/scaffold.test.ts` enforces the byte-for-byte match — re-copy from
  patties-ui if it fails, don't hand-edit.
- `templates/_container/` — `Dockerfile` + `.dockerignore` for `--target container`.
- `templates/_monorepo/` — workspace skeleton (`biome.json`, `packages/README.md`).
- `templates/_shared/patties-patterns.md` — canonical `/patties` body (generated).
- `templates/_claude/` / `templates/_codex/` — agent overlays. `_claude` ships
  `.claude/` (rules, hooks, the `patties-cli` + generated `patties` skills,
  `commands/patties-init.md`) + `CLAUDE.md`; `_codex` ships `.codex/` (incl. the
  generated `rules/patties-patterns.md`) + `AGENTS.md`.

The default app (`templates/default/app/`) uses `setupDevClient` and wraps
`<TodoApp />` in `<Island name="TodoApp">…</Island>` — both are required for
hydration, so don't strip them from the demo. Template `.tsx`/`.ts` files are
biome-linted by the edit hook (so keep them clean) but not typechecked; don't
put `{{token}}` placeholders inside `.tsx` JSX (biome parses them as object
expressions) — interpolate via `app.css`/markdown or programmatically instead.

## Tests

`bun test`. `tests/create-patties.test.ts` + `tests/scaffold.test.ts` run the
scaffolder against tmp dirs (offline, `--no-install`) and assert the output
tree, plus drift guards for the vendored UI starter and the generated skill.

## When updating

- Always test that a freshly scaffolded app actually boots: from the tmp
  output, run `bun install && bunx patties dev` and confirm SSR + hydration.
- After editing `templates/_shared/patties-patterns.md`, run
  `bun run generate:patties-skill` and commit the regenerated files.
- Keep the next-steps message terse. Prefer `bunx patties dev` over
  `bun dev` so the user sees the CLI they'll be using day-to-day.
