# Bun + Patties

Monorepo for the Patties framework and its scaffolder.

## Packages

- [`packages/patties`](packages/patties) — Bun-native full-stack meta-framework. React 19 SSR + filesystem routing on `Bun.serve`. [npm](https://www.npmjs.com/package/patties)
- [`packages/create-patties`](packages/create-patties) — the official scaffolder. [npm](https://www.npmjs.com/package/create-patties)

## Quick start

```sh
bunx create-patties@latest my-app
cd my-app
bun dev
```

## Working on the monorepo

Requires [Bun](https://bun.sh) 1.0+.

```sh
bun install                # workspace install (single root lockfile)
bun run validate           # lint + typecheck + tests + knip
bun --filter patties test  # run a single workspace's tests
bun --filter './packages/*' typecheck
```

Each package is independently versioned via [changesets](https://github.com/changesets/changesets):

```sh
bun changeset              # write a changeset for a change
```

The release pipeline is defined in `.github/workflows/release.yml`. It waits for CI to succeed on `master` then runs `changeset publish` to release whatever is ahead of npm.

## Framework docs

The framework's own conventions and contributor guide live in [`packages/patties/README.md`](packages/patties/README.md) and `packages/patties/AGENTS.md` (auto-generated).

## License

MIT.
