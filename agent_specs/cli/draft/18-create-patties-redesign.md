---
spec: cli/18-create-patties-redesign
title: create-patties redesign — guided scaffold + agent handoff
status: draft
phase: dev-dx
file: packages/create-patties/
last_reviewed: 2026-05-31
supersedes: cli/archive/09-create-patties-dx.md (extends, does not replace)
---

# CLI Spec 18 — `create-patties` redesign

## Purpose

Spec 09 turned the scaffolder into a real interactive prompt with a working
todo demo. This spec re-cuts the prompt flow around capabilities that did not
exist when 09 was written: the **Patties UI** catalog (`patties add`,
`patties ui init` — cli specs 11–15), **monorepo** project layout, **container
/ edge** deploy targets, and **agent handoff** — the scaffolder no longer tries
to scaffold features itself. It ends at a runnable, correctly-shaped project
and then points the user at their coding agent (`claude --permission-mode plan
"/patties-init"`) for interactive, plan-mode feature scaffolding.

The "project pattern" choices (auth-rbac, crm, task, pivot table, dashboard)
are **not CLI prompts**. They are richer than a copy step and live behind the
`/patties` skill and the `/patties-init` plan-mode flow
([spec 19](./19-patties-agent-skill.md)), driven by the agent after scaffold.

## What changes from spec 09

- The prompt flow is reordered and gains two prompts: **coding agent moves
  earlier**, **project type** drives conditional sub-prompts (**Patties UI**,
  **monorepo**), and **deploy target** options now depend on project type.
- `--agent none` is surfaced in the TTY as **"old school"** (no agent files,
  no skill). The flag value stays `none`.
- New: a **monorepo** option for full-stack projects — apps under
  `apps/<app_name>/`, shared code under `packages/`, a Bun workspace at the
  root (the same shape this framework repo itself uses).
- New deploy target **container / docker** for full-stack.
- New: when Patties UI is chosen, the scaffolder runs `patties ui init` and
  stamps a starter set so the demo renders with real components.
- Rewritten next-steps output: alongside `patties dev`, it tells the user to
  open a **new terminal** and run `claude --permission-mode plan
  "/patties-init"` for interactive feature scaffolding.

Everything spec 09 fixed that this does not contradict — the generated README,
the `{{...}}` templating pass, zero runtime dependencies, the "no Claude files
under codex / no codex files under claude" rule, positional-name behavior —
**carries over unchanged**.

## Interactive flow

When stdin is a TTY and the corresponding flag was not passed, prompt in this
order. Each maps to a flag for non-TTY / scripted runs.

1. **Project name** — only when not given as the first positional arg.
   Default `my-patties-app`; validation `/^[a-z0-9][a-z0-9_-]*$/`.
2. **Coding agent** — _"Which coding agent are you using?"_ → `Claude`
   (default) / `Codex` / `old school`. Flag: `--agent`
   (`claude` / `codex` / `none`; `--template` retained as an alias).
3. **Project type** — _"What kind of project are you building?"_ →
   `Frontend` / `Backend` / `Full Stack` (default). Flag: `--type`
   (`frontend` / `backend` / `fullstack`).
   - **3.1 Patties UI** — only when `type ∈ {frontend, fullstack}`: _"Do you
     want a styled UI template (Patties UI)?"_ → `Yes` (default) / `No`. Flag:
     `--ui` / `--no-ui`. (Backend has no UI surface — never asked, always
     `No`.)
   - **3.2 Monorepo** — only when `type = fullstack`: _"Do you want a monorepo
     structure?"_ → `Yes` / `No` (default `No`). Flag: `--monorepo` /
     `--no-monorepo`. Yes ⇒ apps under `apps/<app_name>/`
     (see [Monorepo layout](#monorepo-layout)).
4. **Deploy target** — _"Where will you deploy?"_; options depend on type:
   - **4.1** `type ∈ {frontend, backend}` → `bun` (default) / `worker / edge`.
   - **4.2** `type = fullstack` → `bun` (default) / `worker / edge` /
     `container / docker`.
   - Flag: `--target` (`bun` / `edge` / `container`). `worker / edge` may show
     the spec-09 deploy-plugin sub-prompt (`cloudflare` / `vercel` / `deno` /
     `netlify` / `none`, flag `--deploy`) — optional, defaults to `none`.

`--yes` / `-y` accepts every default and skips all prompts even in a TTY.
Non-TTY runs require flags; missing values fall back to defaults silently.
The `--yes` profile: `agent=claude`, `type=fullstack`, `ui=yes`,
`monorepo=no`, `target=bun`. Theme is a flag only (`--theme`, default
`neutral`; mirrors `patties ui init --theme`, cli spec 11) — not a prompt.

## Project types

The project type selects the demo template, drives the UI / monorepo
sub-prompts, and sets the deploy-target option set. It does not add a runtime
concept to `patties.config.ts`; it is purely a scaffold-shaping choice.

| Type | `app/routes` | `app/islands` | API handlers | UI sub-prompt | Monorepo sub-prompt | Deploy options |
|---|---|---|---|---|---|---|
| **Full Stack** (default) | SSR pages | yes | sample `api/health.ts` | asked (default Yes) | asked (default No) | bun · worker/edge · container/docker |
| **Frontend** | SSR pages | yes | none | asked (default Yes) | — (No) | bun · worker/edge |
| **Backend** | route handlers returning `Response` / `ctx.json()` | none | `api/` tree | — (No) | — (No) | bun · worker/edge |

All three remain real, runnable Patties apps served by `Bun.serve`. Backend
keeps `react` / `react-dom` in `dependencies` (the framework needs them) but
scaffolds no React UI — the demo is API-only. The spec-09 todo demo is the
Full-Stack demo; Frontend trims the API route; Backend replaces page+island
with route handlers.

## Patties UI integration

When the resolved Patties UI choice is `Yes` (Frontend / Full Stack only):

1. Add `patties-ui` to `devDependencies`. (`patties add` never installs — it
   edits `package.json`; the scaffolder's single `bun install` covers it,
   cli spec 14.)
2. Run `patties ui init --theme <theme>` to merge `app/styles/tokens.css` and
   stamp `_internal/` helpers (cli spec 11).
3. Stamp a starter set — `button`, `card`, `input`, `label` — so the demo page
   uses real components, not raw markup.
4. Ensure the app stylesheet imports `tokens.css` and Tailwind v4 per the
   `ui init` wiring instructions.

In a monorepo, all of the above targets the **initial app's** directory
(`apps/<app_name>/`), resolving paths via that app's `patties.config.ts` /
convention. `No` ⇒ none of this runs; the demo uses plain markup.

Ordering: UI setup runs after the template copy + templating pass and after
the agent overlay, but before the single `bun install`.

## Monorepo layout

When `type = fullstack` and monorepo is `Yes`, scaffold a Bun workspace (same
shape as this framework repo):

```
<name>/
  package.json            // private, "workspaces": ["apps/*", "packages/*"]
  biome.json
  apps/
    <app_name>/           // app_name defaults to the project name
      app/                // routes, islands, server.ts (patties source root)
      patties.config.ts
      package.json
  packages/               // shared code (created empty with a README)
  <agent overlay>         // CLAUDE.md/.claude or AGENTS.md/.codex at the root
```

Notes:

- The per-app source root stays `app/` (patties' routing convention); the app
  lives under `apps/<app_name>/`. The user's "src" intent maps to this `app/`
  dir — we do not rename patties' convention.
- The initial `<app_name>` defaults to the project name; additional apps
  (e.g. a separate `api`) are added by the user later under `apps/`.
- `patties dev` / `patties build` run per-app (`bun --filter <app> ...` or from
  inside the app dir). The README documents both.
- Non-monorepo full-stack keeps today's flat layout (`app/` at the root).
- The monorepo is intentionally **Bun-workspaces-only** — no Turborepo / Nx is
  scaffolded. Bun gives topological `bun --filter` execution + catalogs
  natively; the remaining scale gap (task-output caching, affected detection)
  is proposed as a bun-native runner in [[rfc-bun-task-cache]], not a
  third-party orchestrator. Polyglot (Python/Go) is explicitly deferred.
- **Framework prerequisite:** the dev server's single-React resolution must be
  made workspace-aware before `--monorepo` ships (hoisted root `node_modules`
  otherwise loads two copies of React and crashes SSR). See
  [[framework/26-monorepo-react-resolution]].

## Deploy targets

| Choice | Flag | Adapter | Artifacts |
|---|---|---|---|
| **bun** (default) | `bun` | `bun` (`src/adapters/bun`) | long-running `Bun.serve` server |
| **worker / edge** | `edge` | `edge` (`src/adapters/edge`) | portable Worker module; optional vendor plugin via `--deploy` |
| **container / docker** | `container` | `bun` + container | bun-adapter server **plus** a `Dockerfile` (+ `.dockerignore`) for `bun` runtime images; full-stack only |

`container` is the `bun` adapter packaged for a container — it does not
introduce a third framework adapter. The chosen `target` is written to
`patties.config.ts` (`bun` for both `bun` and `container`); container also
emits the Dockerfile.

## Agent overlays + handoff

| `--agent` (TTY label) | `CLAUDE.md` / `.claude/` | `AGENTS.md` / `.codex/` | `/patties` skill + `/patties-init` | Next-steps handoff line |
|---|---|---|---|---|
| `claude` (**Claude**, default) | scaffolded | — | `.claude/skills/patties/`, `.claude/commands/patties-init.md` | `claude --permission-mode plan "/patties-init"` |
| `codex` (**Codex**) | — | scaffolded | `.codex/rules/patties-patterns.md` | open Codex and ask it to scaffold per the rule |
| `none` (**old school**) | — | — | — | use `patties add <component>`; patterns are agent-only |

`AGENTS.md` is still generated on first `patties build` regardless of choice
(framework spec 11). The codex overlay carries identical pattern guidance as a
rule doc, never a `.claude/`-style file (spec 09 overlay-purity rule). The
`/patties-init` command and `/patties` skill are defined in
[spec 19](./19-patties-agent-skill.md).

## Next-steps output

After scaffolding, print terse guidance. Example for `claude`, full-stack,
`ui=yes`:

```
✓ Created my-app

  cd my-app
  bun dev            → http://localhost:3000  (start the dev server)

Patties UI is set up — components live in app/components/ui/.

Want to scaffold features (auth, CRM, task board, dashboard, …)?
Open a NEW terminal in this project and run:

  claude --permission-mode plan "/patties-init"

That starts an interactive, plan-mode session that designs and scaffolds
your project with you before writing any files.
```

- Show the `bun install` line only when `--no-install` was used.
- `codex`: replace the handoff block with the Codex equivalent (open Codex,
  ask it to scaffold using the patterns rule).
- `none` ("old school"): omit the handoff block; instead point at
  `patties add <component>` and the docs for composing patterns by hand.
- Monorepo: show `bun --filter <app_name> dev` (or `cd apps/<app_name> && bun
  dev`) instead of bare `bun dev`.

## Flags (non-interactive)

```
bunx create-patties [name]
  --agent      claude | codex | none                 (default claude)
  --type       frontend | backend | fullstack        (default fullstack)
  --ui | --no-ui                                      (frontend/fullstack; default yes)
  --monorepo | --no-monorepo                          (fullstack only; default no)
  --target     bun | edge | container                (container = fullstack only; default bun)
  --deploy     cloudflare | vercel | deno | netlify | none   (edge only)
  --theme      neutral | slate | stone | zinc         (ui only, default neutral)
  --yes, -y                                           (accept all defaults)
  --no-install
  --git
```

`--template` remains an alias for `--agent` (05 / 09 back-compat).

## Behavior

1. Resolve options: flags → prompts (TTY) → defaults, in that precedence.
   Apply gating: `type=backend` ⇒ `ui=no`; `type≠fullstack` ⇒
   `monorepo=no`, and `container` is not offered.
2. Validate `name`; refuse a non-empty target directory.
3. Copy the template for the chosen project type (+ monorepo skeleton when
   selected) into `./<name>/`; rename `gitignore`→`.gitignore`,
   `README-template.md`→`README.md`.
4. Run the templating pass over text files. Variable set extends 09 with
   `{{type}}`, `{{ui}}`, `{{monorepo}}`, `{{app_name}}`.
5. Patch `package.json` (root + per-app in monorepo; deps incl. `patties-ui`
   when `ui=yes`) and `patties.config.ts` (`target`).
6. Apply the agent overlay for `claude` / `codex` (incl. `/patties` skill +
   `/patties-init` command, or the codex rule). `none` applies nothing.
7. If `ui=yes`: `patties ui init --theme <theme>` + stamp the starter set into
   the (initial) app.
8. If `target=container`: emit `Dockerfile` + `.dockerignore`.
9. Unless `--no-install`, run `bun install`. Preserve 09's git behavior.
10. Print the next-steps output (see above), tailored to agent / type /
    monorepo / ui.

## Implementation notes

- Keep the package **zero-dependency** (09): Bun `prompt()` + string replace.
  The new prompts and conditionals add no libraries.
- `patties ui init` / `patties add` (step 7) invoke the **project's own**
  `patties` binary (resolved after deps land in `package.json`) or call the
  catalog's programmatic stamp API directly (cli specs 11–12). Either way, the
  starter components must exist before `bun dev`. Sequence against
  `bun install` accordingly.
- Prefer a single layered `templates/default/` base with type / monorepo
  overlays over three near-identical trees, to avoid drift.
- The `/patties-init` launch string in the output is **informational text** —
  there is no `--patties-init` claude flag; `/patties-init` is a custom
  command (spec 19) invoked via the initial-prompt argument.

## Tests

- `tests/scaffold.test.ts` — per matrix cell:
  - `--type backend` ⇒ no `app/islands/`, no `.tsx` page, never UI-prompted,
    deploy options exclude `container`.
  - `--type fullstack --monorepo` ⇒ root workspace `package.json` with
    `workspaces`, `apps/<name>/app/`, `packages/` present.
  - `--ui` yes ⇒ `app/components/ui/{button,card,input,label}.tsx` +
    `tokens.css` + `patties-ui` in deps (in the initial app for monorepo);
    `--no-ui` ⇒ none.
  - `--target container` ⇒ `Dockerfile` exists and `patties.config.ts` target
    is `bun`.
  - `--agent claude` ⇒ `.claude/skills/patties/SKILL.md` +
    `.claude/commands/patties-init.md`; `--agent codex` ⇒
    `.codex/rules/patties-patterns.md` and no Claude files; `--agent none` ⇒
    neither.
  - `--yes` deterministic regardless of TTY; matches the default profile.
- CI scaffold-smoke: for representative cells, scaffold, `bun install`,
  `bun dev` (or `--filter` for monorepo), curl `/` (or `/api/health` for
  backend); when `ui=yes`, confirm stamped components render.

## Acceptance criteria

- `bunx create-patties` in a TTY asks the prompts in the order above, with the
  UI / monorepo / deploy sub-rules gated by project type, then scaffolds a
  project that boots with `bun dev`.
- `--type backend` never asks about Patties UI or monorepo and excludes
  `container` from deploy options.
- `--type fullstack --monorepo` produces a Bun workspace with the initial app
  under `apps/<app_name>/`.
- `--ui` (Frontend / Full Stack) yields a demo page importing stamped Patties
  UI components, themed per `--theme`, with no manual `ui init` step.
- `--target container` emits a `Dockerfile`; `worker / edge` writes the edge
  adapter target.
- The next-steps output, for `claude`, prints the exact `claude
  --permission-mode plan "/patties-init"` handoff; for `codex`, the Codex
  equivalent; for `old school`, neither (points at `patties add`).
- The pattern modules are never a CLI prompt or flag — only reachable via the
  `/patties` skill / `/patties-init` flow (spec 19).
- Passing the name as the first positional arg behaves as today.
