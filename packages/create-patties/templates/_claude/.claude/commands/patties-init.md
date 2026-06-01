---
description: Guided, plan-mode first scaffold for a Patties project — pick feature patterns, see a plan, then scaffold after approval.
---

# /patties-init

Guide the user through their first feature scaffold. This command is a thin
driver — all the recipe detail lives in the `patties` skill. Do **not**
duplicate the pattern catalog here; defer to `/patties`.

You are (or should be) in **plan mode**: explore and propose, but write nothing
until the user approves the plan.

Run these four steps:

1. **Discover** — read the project to fit the plan to what was scaffolded:
   - project type (frontend / backend / fullstack) and deploy target, from
     `patties.config.ts` and `package.json`,
   - whether Patties UI is initialized (does `app/components/ui/_internal/`
     exist?),
   - flat vs. monorepo layout (is there an `apps/` workspace?).
2. **Ask** — which feature pattern(s) from the `patties` skill catalog the user
   wants (auth-rbac, crm, task, pivot, dashboard), plus the domain specifics the
   recipes adapt to: entity names, fields, and roles.
3. **Plan** — present the file list, the `patties add` components to stamp, and
   the mock-data shape, honoring the skill's **UI + mock data** depth contract
   (no `bun:sqlite`, migrations, or real backend). Write nothing yet.
4. **Scaffold** — once the user approves and exits plan mode:
   - **Remove the starter demo first.** The scaffolder ships a placeholder
     `app/routes/index.tsx` + `app/islands/TodoApp.tsx` to prove hydration. This
     is pre-`/patties-init` filler — delete both before generating the real
     feature so the first page isn't a throwaway todo list. (Replace `index.tsx`
     with the chosen pattern's landing page, or a minimal welcome if the pattern
     has its own routes.)
   - Generate the files per the `patties` skill recipes. If the catalog isn't
     initialized, run `patties ui init` first.

## Framework constraints (don't re-derive these)

These are stable facts — bake them into the plan instead of tracing the source:

- **Page routes (`.tsx`) receive only `ctx.params`** as props. They cannot read
  cookies, set headers, or redirect. Anything needing those goes in an API route
  or middleware (below). Pages contribute to `<head>` via an exported
  `head()` function.
- **`.ts` route files must live under `app/routes/api/`** (URL `/api/...`). A
  `.ts` route anywhere else is a build error — e.g. logout is
  `app/routes/api/logout.ts` → `/api/logout`, not `app/routes/logout.ts`.
- **`app/middleware.ts` is the only way to gate a page route.** It default-exports
  one global `Middleware (req, ctx, next)` that runs on every request with full
  `ctx` (cookies, `ctx.redirect`). Protect `/admin`-style pages here; never try
  to gate inside the page component.
- **Form POSTs target API routes.** Since pages can't read the request body or
  set cookies, login/mutation forms use a native `<form method="post"
  action="/api/…">` posting to a `.ts` handler that sets the cookie and redirects.
- **`chart` and `form` are client islands** (they pull `recharts` /
  `react-hook-form`). Wrap them in `<Island name="…">`; a server-rendered native
  form avoids `form` entirely.
- **Styling is opt-in per page.** If `app/components/_head.tsx` exists (UI
  projects have it), every new page route must re-export it —
  `export { head } from "../components/_head.tsx";` — or it renders unstyled.

For ongoing work after this first scaffold (adding one component or one more
pattern later), the user invokes the `/patties` skill directly.
