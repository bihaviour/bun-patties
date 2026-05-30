# Contributing to Patties

Thanks for your interest in Patties — a Bun-native full-stack meta-framework.
This guide covers local setup, the checks CI enforces, and how changes are
reviewed and released. By participating you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- [Bun](https://bun.sh) **1.3+** (the repo pins `1.3.14` in `.bun-version`;
  `bun build --compile` requires the 1.3.x macro fix). Patties is Bun-native —
  there is no Node fallback. Use `bun` / `bunx`, not `npm` / `npx` / `yarn`.

## Getting started

This is a Bun workspace monorepo with three packages:

- `packages/patties` — the framework
- `packages/create-patties` — the official scaffolder
- `packages/patties-ui` — the copy-in UI component catalog

```sh
bun install                 # workspace install (single root lockfile)
bun --filter patties test   # run one package's tests
```

## Before you open a PR

Run the full gate locally — CI runs the same thing and will fail on drift:

```sh
bun run validate            # lint + typecheck + test + knip
```

Individual steps if you want them piecemeal:

```sh
bun run check               # biome + tsc --noEmit
bun run lint:fix            # auto-fix Biome diagnostics
bun run test                # bun test across all packages
```

A `PostToolUse` hook also runs `biome check` + `tsc --noEmit` after every edit
when working with Claude Code. **Boy-scout rule:** fix every Biome diagnostic in
any file you touch, even pre-existing ones; don't `// biome-ignore` your way out
without a one-line reason.

If your change affects routes, islands, agents, tools, jobs, middleware, or env
vars in the framework's test fixture, regenerate the agent manifest (CI fails on
drift):

```sh
bun --filter patties generate:agents-md
```

## Conventions

- **Read the rules first.** Project-wide conventions live in
  [`CLAUDE.md`](CLAUDE.md); package-specific notes live in each package's
  `CLAUDE.md`. Architectural guardrails are in
  [`.claude/rules/`](.claude/rules/) — Bun-native primitives only,
  build-time discovery, web-standards boundary, optional AI, and the UI
  catalog. Honor them.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/)
  with a scope, e.g. `feat(ui): …`, `fix(framework): …`, `docs(ui): …`,
  `chore: …`.
- **Keep PRs focused.** Don't expand scope into untouched files just to clean
  them; boy-scout applies to files already in your diff.
- **No new dependencies** that replace a Bun primitive (no `chokidar`,
  `fast-glob`, Express, Webpack, Vite, Jest, …). If you think you need an
  exception, raise it in the PR before adding it.

## Changesets & releases

Each package is independently versioned with
[changesets](https://github.com/changesets/changesets). If your change should
ship in a release, add a changeset describing it:

```sh
bun changeset
```

Maintainers cut releases via the pipeline in `.github/workflows/release.yml`,
which waits for CI on `master` then runs `changeset publish`.

## Reporting bugs & requesting features

Open an issue with a minimal reproduction (a scaffolded app from
`create-patties` is ideal) and the Bun version (`bun --version`). For security
issues, **do not** open a public issue — see [SECURITY.md](SECURITY.md).
