---
spec: ui/phase-0/00-cli-add
title: `bun patties add` — UI component stamper
status: draft
phase: 0
file: src/cli/commands/add.ts
target_repo: /Users/baita-artotel/Development/bihaviour/bun-patties-framework
last_reviewed: 2026-05-27
---

# Spec 00 — `bun patties add` (UI stamper)

## Purpose

Ship the foundation that every UI component spec in [phase-1](../phase-1/) through [phase-4](../phase-4/) depends on: a `patties add` subcommand that copies the canonical source for a component (and its required helpers + peer deps) into the user's project, idempotently.

This spec does **not** ship any components. It ships the plumbing that components plug into. No component spec in a later phase is mergeable until this one is `completed`.

## Public surface

```text
patties add <component> [...components]
patties add --all
patties add --list
patties add --dry-run <component>
```

Behaviour:

- `<component>` is the kebab-case name from the index in [../00-overview.md](../00-overview.md) (`accordion`, `alert-dialog`, `data-table`, …). Numbers are not part of the name.
- `--all` stamps every component whose spec status is `completed` (skips drafts).
- `--list` prints a table of `name | phase | island | status` and exits.
- `--dry-run` prints the file list and `package.json` diff without writing.

Flags inherited from global CLI (`--cwd`, `--config`, `--verbose`) work unchanged. The command refuses to run if `process.env.NODE_ENV === "production"`, mirroring the rule in [`secret`](../../../cli/archive/08-secret-command.md).

## Wiring into the framework

Mounts in [`bun-patties-framework`](../../../../../bun-patties-framework) as:

- `src/cli/commands/add.ts` — `export async function runAdd(argv: string[], ctx: CliContext): Promise<number>`. Mirrors the shape of `runSecret` / `runDeploy`.
- `src/cli/index.ts` — new `case "add":` in the dispatch switch, plus a line in `printHelp()`.
- `src/cli/commands/add/` (subdir) — implementation modules:
  - `registry.ts` — the static component table (name → spec path, peer deps, island flag, helpers, kind, phase, status).
  - `stamper.ts` — writes files under `app/components/ui/`, never overwriting unless `--force`.
  - `peer-deps.ts` — patches `package.json` `dependencies` block; uses pinned versions from the registry.
  - `tokens.ts` — idempotent merge into `app/styles/tokens.css`.
  - `internal.ts` — installs `_internal/cn.ts`, `_internal/slot.ts`, `_internal/variants.ts` on first use.

The framework's package exports do **not** gain a new entry point. Component source lives in the user's repo; the CLI is the only public touchpoint.

## Component registry shape

```ts
export interface ComponentEntry {
  name: string;                 // "alert-dialog"
  spec: string;                 // "ui/phase-3/03-alert-dialog"
  phase: 0 | 1 | 2 | 3 | 4;
  kind: "primitive" | "recipe" | "provider";
  island: "no" | "yes" | "subtree" | "yes-downgrade";
  status: "draft" | "completed";
  files: { from: string; to: string }[];   // source-of-truth paths relative to framework repo
  peerDeps: Record<string, string>;        // npm name -> semver range, merged into user's package.json
  internalHelpers: ("cn" | "slot" | "variants")[];
  tokens?: string[];                       // CSS variable group keys merged into tokens.css
}
```

The registry is a single TS module (`registry.ts`), hand-maintained alongside each phase's components. No filesystem scan at runtime.

## Stamping rules

1. **Destination is fixed**: `<cwd>/app/components/ui/<name>.tsx`. Recipes that produce multiple files (Data Table, Sidebar, Form) emit each file individually as declared in `files`.
2. **Never overwrite** without `--force`. If the destination exists, print a one-line skip notice and continue.
3. **Helpers stamp once**: each `_internal/*.ts` is written only if missing. Helper files are append-only; the CLI does not rewrite them.
4. **Peer deps are merged, not replaced**: only add missing keys. If a user has a stricter range, leave it alone and warn.
5. **tokens.css merge is idempotent**: keyed by CSS-variable block comments (`/* @patties:tokens base */`). Re-running the same `add` is a no-op.
6. **No network at install time**: the CLI does not call `npm install`. It only edits `package.json` and exits with a line telling the user to run `bun install`.

## Source-of-truth layout

Inside `bun-patties-framework`, canonical component source lives at:

```
templates/ui/<name>.tsx                     # single-file primitives
templates/ui/<name>/<filename>.tsx          # multi-file recipes
templates/ui/_internal/{cn,slot,variants}.ts
templates/ui/tokens.css
```

The `add` command reads from these paths inside the installed `patties` package (resolved via `import.meta.resolve("patties/package.json")` and a relative `templates/ui/` lookup). This keeps the spec catalog and the shipped code in lock-step: a component is "implementable" only when both the markdown spec exists in `agent_specs/ui/progress/phase-N/` and the source exists under `templates/ui/`.

## Cross-cutting test harness (foundation for every later phase)

Phase-0 also ships test utilities under `bun-patties-framework/tests/ui/`:

- `renderStatic(component)` — wraps `renderToReadableStream` with the project's default `tokens.css` and returns the resulting HTML string.
- `hydrate(component)` — boots the island bundle in a `happy-dom` (or Bun's built-in DOM) environment and asserts no console errors during hydration.
- `assertJsonProps(component, props)` — fails if any prop crossing the island boundary fails `JSON.stringify` round-trip.

These three helpers are what every component-level "Acceptance criteria" in later phases will reference. Their public signatures are frozen by this spec.

## Acceptance criteria

- `patties add --list` prints all 60 components from [../00-overview.md](../00-overview.md) plus their current `status`.
- `patties add alert` (after the alert spec ships in phase-1) writes exactly `app/components/ui/alert.tsx` and any required `_internal/*` files, patches `package.json`, and merges `tokens.css`. A second invocation is a no-op.
- `patties add unknown-name` exits non-zero with `unknown component: unknown-name`.
- `patties add --dry-run badge` writes nothing but prints the would-be file list and `package.json` diff.
- Running `patties add` from a directory without a `package.json` exits non-zero with `not a Patties project (no package.json found at <cwd>)`.
- `tests/ui/renderStatic.test.ts` and `tests/ui/hydrate.test.ts` exist and pass against a fixture component shipped under `tests/ui/__fixtures__/`.
- `bun run check` (Biome + tsc) passes on every new file. The `PostToolUse` hook from [framework conventions](../../../framework/archive/13-conventions.md) gates this.
- The command is registered in `printHelp()` and listed in `README.md` under "Commands".

## Out of scope (deferred to later specs)

- Per-component spec authoring — each phase's components own their own spec files.
- `patties remove <component>` — additive-only for now.
- `patties update <component>` (re-stamp from new spec version) — deferred to a phase-5 maintenance spec.
- Theming editor / token UI — userland concern.
- Registry-driven plugin components (third-party `patties add` providers) — out of scope until the core 60 are shipped.

## Open questions

1. Should `--force` be a per-file confirmation (interactive) or all-or-nothing? Default proposal: all-or-nothing, since the CLI is meant to be re-runnable in CI.
2. Where does the registry live long-term — hand-maintained TS, or generated from frontmatter in `agent_specs/ui/progress/**/*.md`? Phase-0 ships hand-maintained; revisit once 20+ components are completed.
