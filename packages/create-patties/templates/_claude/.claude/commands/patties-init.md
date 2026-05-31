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
4. **Scaffold** — once the user approves and exits plan mode, generate the files
   per the `patties` skill recipes. If the catalog isn't initialized, run
   `patties ui init` first.

For ongoing work after this first scaffold (adding one component or one more
pattern later), the user invokes the `/patties` skill directly.
