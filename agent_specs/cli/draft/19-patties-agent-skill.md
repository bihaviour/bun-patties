---
spec: cli/19-patties-agent-skill
title: /patties skill + /patties-init flow — components & pattern modules
status: draft
phase: dev-dx
file: packages/create-patties/templates/_claude/.claude/skills/patties/, packages/create-patties/templates/_claude/.claude/commands/patties-init.md, packages/create-patties/templates/_codex/.codex/rules/patties-patterns.md
last_reviewed: 2026-05-31
---

# CLI Spec 19 — `/patties` skill & `/patties-init` flow

## Purpose

The redesigned scaffolder ([spec 18](./18-create-patties-redesign.md)) stops
at a runnable project. The richer feature patterns a developer actually wants
to start from — auth with RBAC, a CRM, a task board, a pivot table, a
dashboard — are too varied to ship as a copy step and too domain-specific to
freeze into a template. This spec defines the `/patties` **agent skill** that
`create-patties` drops into Claude / Codex projects: an instruction set the
coding agent uses to (1) add Patties UI components and (2) scaffold a feature
pattern on request, generating the code itself — plus the **`/patties-init`**
command that the scaffolder's next-steps output hands off to for a guided,
plan-mode first scaffold.

## Why a skill, not a CLI command (the decision)

Pattern scaffolding is **instruction-driven code generation**, not a
deterministic stamp:

- The agent reads the skill, then writes the module's files using its own
  judgement — adapting field names, columns, and copy to the user's domain
  ("a CRM for veterinary clinics") instead of emitting a fixed template.
- There is **no `patties <pattern>` CLI command**. Patterns are reachable
  **only** through the skill. "Old school" (no-agent) projects do not get the
  skill and compose patterns by hand from `patties add` components.

Trade-off, stated plainly: this is non-deterministic and not unit-testable the
way a stamp is, and it is unavailable without a coding agent. We accept that in
exchange for patterns that fit the user's actual domain. Components remain a
deterministic CLI (`patties add`, cli spec 12) for everyone; only the
multi-file *patterns* are skill-only.

## Where it's scaffolded

| `--agent` (spec 18) | Pattern guidance ships as | Invocation |
|---|---|---|
| `claude` | `.claude/skills/patties/SKILL.md` (+ helpers) and `.claude/commands/patties-init.md` | `/patties` ad hoc; `/patties-init` for the guided first scaffold |
| `codex` | `.codex/rules/patties-patterns.md`, referenced from `AGENTS.md` | the agent reads the rule; user asks in prose |
| `none` ("old school") | — | — (components only, via `patties add`) |

The codex form carries identical guidance as a rule doc — **never** a
`.claude/`-style skill file (spec 18 / spec 09 overlay-purity rule). Both forms
are generated from a single source so the catalog cannot drift between agents.

This skill is distinct from the existing `patties-cli` skill (which covers
`dev` / `build` / `deploy` / `secret`). `/patties` covers **scaffolding**:
adding components and patterns. The skill cross-references `patties-cli` for
running the app and points at cli specs 11–15 for the underlying commands.

## Capabilities

### 1. Add a UI component

A thin wrapper over the deterministic catalog. When the user asks for a
component, the skill instructs the agent to:

1. Ensure the catalog is initialized — if `app/components/ui/_internal/` is
   absent, run `patties ui init` (cli spec 11) first.
2. Run `patties add <name>` (cli spec 12), optionally previewing with
   `patties view <name>` / `patties add --view` first.
3. Import and use the stamped component; never re-author component source by
   hand (the registry is the source of truth, ui-catalog rule).

This path is fully deterministic — the skill adds nothing the CLI doesn't
already do except picking the right component and wiring the import.

### 2. Scaffold a pattern module

Instruction-driven. For each pattern the skill specifies: a one-line goal, the
Patties UI components to `patties add` first, the files to generate, and the
mock-data shape. The agent then writes the files, adapting names/fields to the
user's stated domain.

## Depth contract: UI + mock data

Every pattern is scaffolded at **"UI + mock data"** depth:

- **In scope:** SSR routes / pages, islands where interactivity is needed,
  stamped Patties UI components, and a typed in-memory seed in
  `app/lib/mock-<entity>.ts` that the pages read from.
- **Out of scope:** `bun:sqlite`, migrations, a real persistence or auth
  backend, network calls. The pattern *shows the shape*; the developer swaps
  mock data for a real source later.
- Every generated module includes a top-of-file `// TODO: replace mock data
  with a real source` marker and a short note in the route/page so the mock
  boundary is obvious.

A full `bun:sqlite`-backed vertical slice is explicitly deferred to a future
spec; do not generate a DB layer from this skill.

## Pattern catalog

| Pattern | Goal | `patties add` components | Generated files (under `app/`) |
|---|---|---|---|
| **auth-rbac** | Login / logout + role-gated route | `form`, `input`, `label`, `button`, `card` | `routes/login.tsx`, `routes/logout.ts`, `routes/admin.tsx` (role-gated), `lib/auth.ts` (cookie session over mock users), `lib/rbac.ts` (role guard), `lib/mock-users.ts` |
| **crm** | Contacts list + detail/edit | `data-table`, `dialog`, `form`, `input`, `button`, `badge` | `routes/contacts/index.tsx` (table), `routes/contacts/[id].tsx` (detail), `islands/ContactForm.tsx`, `lib/mock-contacts.ts` |
| **task** | Task board / list | `card`, `checkbox`, `badge`, `dialog`, `button` | `routes/tasks.tsx`, `islands/TaskBoard.tsx` (columns + toggle), `lib/mock-tasks.ts` |
| **pivot table** | Group-by / pivot over rows | `table`, `select`, `card` | `routes/pivot.tsx`, `islands/PivotTable.tsx` (choose row/col/measure dimensions), `lib/mock-rows.ts` |
| **dashboard** | Metrics overview | `card`, `chart`, `separator`, `sidebar` | `routes/dashboard.tsx` (cards + chart + sidebar shell), `lib/mock-metrics.ts` |

Per-pattern recipe notes the SKILL.md spells out for the agent:

- **auth-rbac** — sessions are a signed cookie over the mock user list; the
  RBAC guard is a small helper the protected route calls in its handler. Make
  the mock-only nature loud: a banner on the login page and a TODO at the auth
  module top. Real auth needs persistence (future DB spec).
- **crm** — the list uses `data-table` (a recipe component, ui registry kind
  `recipe`) over `mock-contacts`; create/edit happens in a `dialog` driven by a
  `form` island. Detail route reads the same mock store by id.
- **task** — board is an island holding `useState` columns; toggling a
  `checkbox` moves a task between done/not-done. No persistence — state resets
  on reload (call this out).
- **pivot table** — an island lets the user pick row dimension, column
  dimension, and a numeric measure from `select`s, then renders the aggregated
  `table`. Aggregation runs client-side over the mock rows.
- **dashboard** — static SSR shell (`sidebar` is `subtree`, `chart` hydrates)
  with metric `card`s fed by `mock-metrics`; the chart is the one interactive
  island.

The agent always runs `patties add <components>` for the listed components
(initializing the catalog first if needed) before generating files that import
them.

## The `/patties-init` plan-mode flow

`create-patties` ends by pointing the user at a guided first scaffold
(spec 18, next-steps output). The exact handoff string it prints is:

```
claude --permission-mode plan "/patties-init"
```

This is the only realistic encoding — there is **no `--patties-init` claude
flag**. `claude` accepts an initial prompt as a positional argument and a
`--permission-mode plan` flag; `/patties-init` is a custom command invoked via
that initial prompt. The session opens in **plan mode** (read-only: the agent
explores and proposes, but writes nothing until the user approves the plan).

`/patties-init` ships as `.claude/commands/patties-init.md` and drives an
interactive Q&A on top of this skill:

1. **Discover** — read the project (type, deploy target, whether Patties UI is
   initialized, monorepo or flat) so the plan fits what was scaffolded.
2. **Ask** — which feature pattern(s) from the [catalog](#pattern-catalog) the
   user wants, and the domain specifics (entity names, fields, roles) that the
   instruction-driven recipes adapt to.
3. **Plan** — present the file list, the `patties add` components to stamp, and
   the mock-data shape, honoring the [depth contract](#depth-contract-ui--mock-data).
   Nothing is written yet (plan mode).
4. **Scaffold** — once the user approves and exits plan mode, generate the
   files per the skill's recipes, running `patties ui init` first if the
   catalog is absent.

`/patties-init` is the **guided onboarding** entry; the `/patties` skill is the
**ongoing** entry for adding a component or one more pattern later. The command
is a thin driver — all pattern knowledge lives in the skill, so the two cannot
drift. Codex has no plan-mode/slash-command analog: its
`.codex/rules/patties-patterns.md` documents the same Q&A → plan → scaffold
sequence as guidance the user triggers in prose. "old school" gets no init
flow.

## SKILL.md shape

The Claude skill file (`.claude/skills/patties/SKILL.md`) follows the standard
skill format already used by `patties-cli`:

- **Front-matter**: `name: patties`, a `description` whose trigger phrases
  include _"add a component", "scaffold a CRM / dashboard / auth", "patties
  pattern", "/patties"_.
- **Body sections**: _When to use_ · _Add a component_ (capability 1) ·
  _Scaffold a pattern_ (capability 2, with the catalog table + per-pattern
  recipes) · _Depth contract_ (UI + mock data, what not to generate) ·
  _Conventions_ (routes/islands/lib layout, `mock-*` naming, TODO markers,
  ui-catalog rules) · _See also_ (`patties-cli` skill, cli specs 11–15).

The codex rule doc (`.codex/rules/patties-patterns.md`) carries the same body
sections in rule voice and is linked from `AGENTS.md`'s rules list.

The `/patties-init` command file (`.claude/commands/patties-init.md`) is short:
it sets up plan mode expectations and the four-step Q&A above, then defers to
the `patties` skill for all recipe detail. It must not duplicate the catalog.

## Relationship to Patties UI

- The skill never re-authors component source; it stamps from the catalog
  (`patties add`) and imports. Registry is the source of truth (ui-catalog
  rule).
- If the project was scaffolded with `--no-ui`, the skill's first action for
  *either* capability is `patties ui init` (with the project's configured /
  default theme), then proceed. Patterns require the catalog.
- Components used by patterns are exactly catalog entries with
  `status: "completed"`; the skill must not reference a component that isn't in
  the shipped registry.

## Acceptance criteria

- A `claude`-scaffolded project contains `.claude/skills/patties/SKILL.md`
  invocable as `/patties` **and** `.claude/commands/patties-init.md` invocable
  as `/patties-init`; a `codex`-scaffolded project contains
  `.codex/rules/patties-patterns.md` linked from `AGENTS.md`; an "old school"
  project contains neither.
- `claude --permission-mode plan "/patties-init"` opens a plan-mode session
  that asks which pattern(s) to scaffold, presents a plan without writing, and
  scaffolds only after approval. `/patties-init` duplicates none of the
  catalog — it defers to the `patties` skill.
- Asking `/patties` to add a component results in `patties add <name>` running
  (catalog initialized first if absent) and the component imported — no
  hand-authored component source.
- Asking `/patties` to scaffold any of the five patterns produces routes +
  (where listed) islands + a typed `app/lib/mock-<entity>.ts`, with the listed
  Patties UI components stamped first and a visible mock-data TODO marker.
- No generated pattern introduces `bun:sqlite`, migrations, or a real auth /
  network backend.
- The Claude skill body and the Codex rule doc are generated from one source;
  the pattern catalog is identical between them.
- There is no `patties <pattern>` CLI command anywhere; patterns are
  skill-only by design.
