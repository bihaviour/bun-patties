---
spec: cli/09-create-patties-dx
title: create-patties DX overhaul
status: draft
phase: dev-dx
file: packages/create-patties/
last_reviewed: 2026-05-27
supersedes: cli/archive/05-create-patties.md (extends, does not replace)
---

# CLI Spec 09 — `create-patties` DX overhaul

## Purpose

The Phase-0 scaffolder (spec 05) gets users a project directory. It does not
get them to "wow" — the default page is one line of text, the README is three
shell commands, and the interactive path silently picks defaults the user
never sees. This spec replaces the default template with a working
mini-application, rewrites the README to actually onboard, and turns the
flag-driven scaffolder into a real interactive prompt.

This spec depends on framework spec 17 (dev-time island bundler) for the
demo template to feel like a working app on first `bun dev`.

## Scope (the five items)

### 1. Demo template — a tiny todo app

Replace the current `default` template's `app/routes/index.tsx` +
`app/islands/Counter.tsx` with a small todo app that demonstrates:

- **Static SSR**: page header, current date, and the initial todo list are
  rendered on the server.
- **Island hydration**: the todo input + list is a single island
  (`app/islands/TodoApp.tsx`) using `useState`. New users see state
  actually change when they click.
- **HMR**: edits to either the route file or the island reload the page /
  hydrate the new island without a full restart. The README points at
  specific lines to edit to see HMR in action.
- **No persistence**: state is in-memory. We are demonstrating the
  framework, not building a product. Persistence belongs in an
  `ai-starter` / `with-db` template later.

File layout:

```
app/
  routes/
    index.tsx          // server-rendered shell + <TodoApp /> island
  islands/
    TodoApp.tsx        // useState-based todo list
  server.ts            // dev entry (see spec 17 contract)
patties.config.ts
package.json
README.md              // generated from README-template.md (item 2)
tsconfig.json
.gitignore
```

The `with-islands` and `ai-starter` templates referenced in spec 05 are
**not in scope here** — they remain future work.

### 2. README — real onboarding

Today's `README-template.md` is essentially `cd <name>; bun dev`. Replace it
with a generated README that includes the actual project name and the
specific structure of the scaffolded app. The generator interpolates
`{{name}}`, `{{agent}}`, `{{target}}`, and `{{deploy}}` placeholders.

Sections (in order):

1. **`# {{name}}`** — H1 with the project name.
2. **What you got** — one-paragraph description of the todo demo and which
   files are interesting.
3. **Run it** —
   ```
   bun install     # if --no-install was used
   bun dev         # → http://localhost:3000
   ```
4. **Try HMR** — concrete instructions:
   _"Open `app/routes/index.tsx`, change the heading text, save. The
   browser refreshes. Open `app/islands/TodoApp.tsx`, change the placeholder
   text, save. The island re-hydrates without losing your other tabs."_
5. **Project layout** — annotated tree of `app/`.
6. **Build for production** — `bun run build`, where artifacts land, how
   to run them (`patties start` or the adapter's instructions).
7. **Deploy** — present only when `--deploy` is not `none`; one-paragraph
   pointer to the deploy plugin's docs.
8. **Agent tooling** — present only when `--template` is `claude` or
   `codex`; describes what was scaffolded (CLAUDE.md / .claude/ vs
   AGENTS.md / .codex/) and how to launch the agent.
9. **Where to learn more** — links to the framework docs site.

The generator lives in `packages/create-patties/src/readme.ts`. Template
source is `templates/default/README-template.md` with `{{...}}`
placeholders. Variant sections (deploy, agent) are gated by HTML-comment
markers that the generator strips/keeps based on the chosen options:

```
<!-- if:agent=claude -->
## Claude Code is set up
…
<!-- /if -->
```

### 3. Interactive prompts

When stdin is a TTY and the corresponding flag was not passed, prompt:

1. **Project name** (only if not given as the first positional arg — see
   item 5).
2. **Runtime target** — `bun` (default) or `edge`.
3. **Deploy plugin** — only when `target=edge`. Same options as spec 05.
4. **AI coding agent** — `Claude Code` / `Codex (AGENTS.md)` / `None`.
   - Question text: _"Which AI coding agent will you use? We'll scaffold
     the right files for the one you pick."_
   - Maps to `--template` flag: `claude` / `codex` / `none`. The spec-05
     `--agent` flag name is retained as an alias for backwards
     compatibility.

Implementation uses Bun's built-in `prompt()` (no new dependency). Non-TTY
runs require the equivalent flags; missing values fall back to documented
defaults silently. Add a `--yes` flag that accepts all defaults and skips
all prompts even in a TTY (for CI / scripting).

### 4. Agent-tooling scaffolding

Extend the agent matrix from spec 05:

| `--template` | `AGENTS.md` | `CLAUDE.md` | `.claude/` | `.codex/` |
|---|---|---|---|---|
| `none` (default in non-TTY) | generated on first `patties build` | — | — | — |
| `claude` | generated on first `patties build` | scaffolded immediately | scaffolded immediately | — |
| `codex` | **scaffolded immediately** and regenerated on `patties build` | — | — | scaffolded immediately |

#### `claude` overlay

The existing `_claude` overlay covers `.claude/settings.json`. Spec 09
expands it to include:

- `CLAUDE.md` at project root with project-specific rules pulled from the
  framework's own `CLAUDE.md` conventions (Bun-native, web-standards
  boundary, build-time discovery, optional AI). The text is tuned for
  _users_ of the framework, not contributors — so "don't pull in
  chokidar" becomes "we use `Bun.serve` / `Bun.Glob` / `Bun.build`; reach
  for those first".
- `.claude/settings.json` with sensible defaults for a Patties app
  (permissions to run `bun`, `bunx`, `patties`).
- `.claude/hooks/` with the framework's `biome-check.sh` PostToolUse hook
  adapted to the user's project (Biome optional — the hook no-ops if
  Biome isn't installed).
- `.claude/agents/` and `.claude/commands/` directories present but empty
  with a one-line README pointing at the Claude Code docs. (No
  speculative subagents — the user can add their own.)

#### `codex` overlay

New `templates/_codex/` overlay. Must contain **no Claude-specific files**.

- `AGENTS.md` at project root, hand-authored with the same content as the
  Claude rules but framed neutrally. Subsequent `patties build` runs
  regenerate it via the existing `agents-md` generator, which already
  preserves user-edited sections marked with HTML comments (see framework
  spec 11). Document that contract in the file's header so the user knows
  what survives regeneration.
- `.codex/` directory with whatever is the current Codex convention. As
  of this spec's writing the convention is unsettled; ship a minimal
  `.codex/README.md` pointing at the Codex docs and leave room for
  contributors to fill in. **Do not** add a `.claude/` or `CLAUDE.md` in
  this template under any circumstance.

### 5. Project-name handling

Today the CLI silently exits with code 2 if no name is given. New behavior:

- If the first positional arg is missing **and** stdin is a TTY:
  prompt for a name. Default suggestion: `my-patties-app`. Reject and
  re-prompt on invalid input.
- If the first positional arg is missing **and** stdin is not a TTY:
  exit with the current usage message (unchanged).
- The chosen name flows into:
  - The target directory.
  - `package.json#name`.
  - The README H1 and every `{{name}}` placeholder.
  - The "Next steps" output (`cd <name>; bun dev`).
  - The success-path Claude/Codex hint message.

Validation is unchanged from spec 05 (`/^[a-z0-9][a-z0-9_-]*$/`).

## Implementation notes

- The CLI today is `bin/create-patties.ts` → `src/index.ts`. The interactive
  prompts and README rendering get their own modules
  (`src/prompts.ts`, `src/readme.ts`) so the run loop stays readable.
- Template files use `{{name}}` interpolation in `package.json`,
  `README.md`, and any other text file. The copy step gains a
  templating pass — currently it's a plain `cp -R`. Use a simple
  in-process walk rather than adding a dependency.
- The `_claude` and `_codex` overlays are copied **after** the templating
  pass on `default`, so overlay files can also use `{{...}}` placeholders
  (used in the README's agent section).
- Keep the package zero-dependency. No `prompts`, no `enquirer`, no
  `mustache`. Bun's `prompt()` + manual string replace are enough.

## Tests

- `tests/scaffold.test.ts` (new) — drive `run()` with synthetic argv,
  assert:
  - Correct files exist for each `--template` choice.
  - No `.claude/` or `CLAUDE.md` ever appears under `--template codex`.
  - No `.codex/` ever appears under `--template claude`.
  - README contains the project name as the H1.
  - `--yes` produces a deterministic output regardless of TTY state.
- CI: existing scaffold-smoke job runs `bunx create-patties` for each
  agent choice + each target, then runs `bun dev` against it and curls
  `/` to confirm the demo todo page SSRs.

## Acceptance criteria

- `bunx create-patties` with no args in a TTY prompts for the name and
  agent choice, then scaffolds correctly.
- `bunx create-patties demo && cd demo && bun dev` → opening the browser
  shows the todo demo with a working interactive list (depends on
  framework spec 17).
- Generated README contains the project name in the H1 and accurately
  describes the demo app, build steps, and (where relevant) the chosen
  agent tooling.
- `--template codex` produces a project with zero references to Claude
  Code; `--template claude` produces a project with zero references to
  Codex.
- Passing the name as the first positional arg behaves exactly as today
  (no prompt, immediate scaffold) so existing scripts keep working.
