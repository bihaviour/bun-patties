---
"create-patties": minor
---

Scaffolder DX overhaul (specs 09 + 10).

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
