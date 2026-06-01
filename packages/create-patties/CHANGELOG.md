# create-patties

## 0.0.12

### Patch Changes

- a99d1bf: Redesign the scaffolder prompt flow (cli specs 18 + 19): coding agent moves
  earlier; a new **project type** (frontend / backend / fullstack) drives gated
  sub-prompts for **Patties UI** and **monorepo** and the deploy-target option
  set. Adds `--type`, `--ui`/`--no-ui`, `--monorepo`/`--no-monorepo`, `--theme`,
  and a `container` target (emits a `Dockerfile`). When Patties UI is chosen, a
  vendored starter set (button/card/input/label + tokens) is stamped so the demo
  renders with real components. Claude / Codex projects now ship the `/patties`
  skill + `/patties-init` command (Codex: a `patties-patterns` rule), generated
  from one source so they can't drift, and the next-steps output hands off to
  `claude --permission-mode plan "/patties-init"`. Stays zero-dependency.

## 0.0.12-next.0

### Patch Changes

- a99d1bf: Redesign the scaffolder prompt flow (cli specs 18 + 19): coding agent moves
  earlier; a new **project type** (frontend / backend / fullstack) drives gated
  sub-prompts for **Patties UI** and **monorepo** and the deploy-target option
  set. Adds `--type`, `--ui`/`--no-ui`, `--monorepo`/`--no-monorepo`, `--theme`,
  and a `container` target (emits a `Dockerfile`). When Patties UI is chosen, a
  vendored starter set (button/card/input/label + tokens) is stamped so the demo
  renders with real components. Claude / Codex projects now ship the `/patties`
  skill + `/patties-init` command (Codex: a `patties-patterns` rule), generated
  from one source so they can't drift, and the next-steps output hands off to
  `claude --permission-mode plan "/patties-init"`. Stays zero-dependency.

## 0.0.8

### Patch Changes

- 3b3f80d: Scaffolder DX overhaul (specs 09 + 10).

  - **Tool probes** — fail fast with a clear message when `bun` is missing
    from PATH; skip-and-warn when `git` is missing instead of silently
    swallowing failures.
  - **Interactive prompts** — when stdin is a TTY and flags were not passed,
    prompt for project name, target, deploy, and agent. Add `--yes` / `-y`
    to accept all defaults non-interactively.
  - **`--agent` alias** — the spec-05 `--agent claude-code` form is kept as
    a backwards-compatible alias for `--template claude`.
  - **Expanded agent overlays** — `_claude` now ships
    `.claude/settings.json` (with `bun`/`bunx`/`patties` permissions and a
    Biome PostToolUse hook), `.claude/hooks/biome-check.sh` (no-ops when
    Biome is not installed), and empty `.claude/agents/` /
    `.claude/commands/` directories with README pointers. `_codex` now
    ships a `.codex/README.md`.
  - **Templated README** — `templates/default/README-template.md` is now a
    real onboarding doc with `{{name}}` / `{{agent}}` / `{{target}}` /
    `{{deploy}}` placeholders and HTML-comment conditional blocks. A
    generic templating pass also interpolates `{{name}}` into CLAUDE.md
    and AGENTS.md.

  - **Todo demo template** — the default scaffold now ships a `TodoApp.tsx`
    island and a route that mounts it. The README explains that buttons
    don't react under `bun dev` today (dev hydration lands with framework
    spec 18) and tells the user to `bun run build && bun start` to see the
    island work; it also includes a "Remove the demo" section for when the
    user is ready to start their real app.
  - **`--blank` flag** — `bunx create-patties@latest <name> --blank`
    (alias: `--empty`) scaffolds a hello-world page with no demo and no
    `app/islands/` directory.
  - **Demo prompt** — interactive flow asks "Include the interactive
    todo demo? [Y/n]" right after the agent question.
  - **Git is now opt-in** — `git init` no longer runs by default. Pass
    `--git` to opt in. The success output reminds the user how to
    initialise a repo when they're ready. `--no-git` is kept as a no-op
    for back-compat.
  - **`_claude` overlay restructured.** The empty `.claude/agents/` and
    `.claude/commands/` placeholders are gone. Replaced with:
    - `.claude/skills/patties-cli/SKILL.md` — a real skill teaching
      Claude how to use the project CLI (`patties dev/build/start/deploy/secret`).
    - `.claude/rules/` — scaffolded meta-framework knowledge:
      `bun-native.md`, `web-standards-boundary.md`,
      `filesystem-routing.md`, `islands.md`, `build-time-discovery.md`,
      `optional-ai.md`. Mirrors the framework's own rules but tuned
      for users of the framework.
