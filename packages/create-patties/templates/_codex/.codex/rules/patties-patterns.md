# Patties patterns — components & feature scaffolding

> Codex rule. The catalog and recipes below are shared verbatim with the
> Claude `/patties` skill — both are generated from one source
> (`templates/_shared/patties-patterns.md` in create-patties), so they
> cannot drift. Read this when the user asks to add a component or scaffold a
> feature pattern.

## When to use

Use this when the user wants to **add a Patties UI component** or **scaffold a
feature pattern** (auth + RBAC, a CRM, a task board, a pivot table, a
dashboard). It covers scaffolding only — for running, building, deploying, or
managing secrets, use the `patties-cli` skill instead.

Two capabilities:

1. **Add a UI component** — a thin wrapper over the deterministic catalog.
2. **Scaffold a feature pattern** — instruction-driven: you generate the files,
   adapting names/fields/copy to the user's domain.

## Add a component

The component catalog is deterministic — never hand-author component source; the
registry is the source of truth.

1. If `app/components/ui/_internal/` does not exist, the catalog isn't
   initialized — run `patties ui init` first (pass `--theme <neutral|slate|stone|zinc>`
   to match the project).
2. Run `patties add <name>` (preview first with `patties view <name>` or
   `patties add --view <name>` if the user wants to see the source).
3. Import the stamped component from `app/components/ui/<name>.tsx` and use it.

`patties add` edits `package.json` (it never runs an install) and stamps source
into `app/components/ui/`. After adding, remind the user to run `bun install` if
new peer deps were added.

## Scaffold a pattern

Pick the pattern from the catalog, `patties add` its components first, then
generate the listed files — adapting entity names, fields, columns, and copy to
the user's stated domain (e.g. "a CRM for veterinary clinics").

| Pattern | Goal | `patties add` components | Generated files (under `app/`) |
|---|---|---|---|
| **auth-rbac** | Login / logout + role-gated route | `input`, `label`, `button`, `card` | `routes/login.tsx` (native POST form), `routes/api/login.ts`, `routes/api/logout.ts`, `routes/admin.tsx` (gated by middleware), `app/middleware.ts` (gates `/admin`), `lib/auth.ts` (cookie session over mock users), `lib/rbac.ts` (role guard), `lib/mock-users.ts` |
| **crm** | Contacts list + detail / edit | `data-table`, `dialog`, `form`, `input`, `button`, `badge` | `routes/contacts/index.tsx` (table), `routes/contacts/[id].tsx` (detail), `islands/ContactForm.tsx`, `lib/mock-contacts.ts` |
| **task** | Task board / list | `card`, `checkbox`, `badge`, `dialog`, `button` | `routes/tasks.tsx`, `islands/TaskBoard.tsx` (columns + toggle), `lib/mock-tasks.ts` |
| **pivot** | Group-by / pivot over rows | `table`, `select`, `card` | `routes/pivot.tsx`, `islands/PivotTable.tsx` (pick row/col/measure), `lib/mock-rows.ts` |
| **dashboard** | Metrics overview | `card`, `chart`, `separator`, `sidebar` | `routes/dashboard.tsx` (cards + chart + sidebar shell), `lib/mock-metrics.ts` |

Per-pattern recipes:

- **auth-rbac** — sessions are a signed cookie over the mock user list. Because
  pages can't read cookies or redirect (see Conventions), the gate lives in
  `app/middleware.ts`: it checks the session + role and redirects unauthenticated
  `/admin` hits to `/login`. The login page is a native `<form method="post"
  action="/api/login">` (no `form` component) posting to `routes/api/login.ts`,
  which sets the cookie and redirects; `routes/api/logout.ts` clears it. Make the
  mock-only nature loud: a banner on the login page and a TODO at the top of the
  auth module. Real auth needs persistence (a future DB spec).
- **crm** — the list uses `data-table` over `mock-contacts`; create / edit
  happens in a `dialog` driven by a `form` island. The detail route reads the
  same mock store by id.
- **task** — the board is an island holding `useState` columns; toggling a
  `checkbox` moves a task between done / not-done. No persistence — state resets
  on reload (call this out).
- **pivot** — an island lets the user pick a row dimension, a column dimension,
  and a numeric measure from `select`s, then renders the aggregated `table`.
  Aggregation runs client-side over the mock rows.
- **dashboard** — a static SSR shell (`sidebar` is `subtree`, `chart` hydrates)
  with metric `card`s fed by `mock-metrics`; the chart is the one interactive
  island.

Always `patties add` the listed components (initializing the catalog first if
needed) before generating files that import them. Only reference components that
exist in the shipped registry with `status: "completed"`.

## Depth contract: UI + mock data

Every pattern is scaffolded at **"UI + mock data"** depth:

- **In scope:** SSR routes / pages, islands where interactivity is needed,
  stamped Patties UI components, and a typed in-memory seed in
  `app/lib/mock-<entity>.ts` that the pages read from.
- **Out of scope:** `bun:sqlite`, migrations, a real persistence or auth
  backend, network calls. The pattern *shows the shape*; the developer swaps the
  mock data for a real source later.
- Every generated `mock-*` module starts with `// TODO: replace mock data with a
  real source`, and the route / page carries a short note marking the mock
  boundary.

Do not generate a database layer, migrations, or a real auth/network backend
from this skill — that is deferred to a future spec.

## Conventions

- Pages live under `app/routes/*.tsx` (default-export a React component); API
  handlers under `app/routes/api/*.ts` (named `GET`/`POST`/… returning a
  `Response`, e.g. via `ctx.json()`). Dynamic segments use `[id]`. A `.ts` route
  **must** be under `app/routes/api/` — anywhere else is a build error.
- **Pages get only `ctx.params`** — they can't read cookies, set headers, or
  redirect. Push that work to an API route or to `app/middleware.ts` (the single
  global `Middleware (req, ctx, next)`, the only place to gate a page). Mutation
  forms use a native `<form method="post" action="/api/…">` posting to a `.ts`
  handler.
- Islands (interactive client components) live under `app/islands/` and are
  wrapped at the use site in `<Island name="…">…</Island>` from `patties/render`.
  `chart` and `form` are islands (they pull `recharts` / `react-hook-form`).
- **Styling is opt-in per page.** If `app/components/_head.tsx` exists, every new
  page route must re-export it (`export { head } from "../components/_head.tsx";`)
  or it renders unstyled. Run `bun run css` (or `bun run css:watch`) after adding
  classNames; `dev`/`build` compile it for you.
- Mock data lives in `app/lib/mock-<entity>.ts`, typed, with the TODO marker.
- Never re-author component source — stamp from the catalog and import.

## See also

- The `patties-cli` skill — running, building, deploying the app.
- cli specs 11–15 (Patties UI: `ui init`, `add`, `view`, `update`, registries).
