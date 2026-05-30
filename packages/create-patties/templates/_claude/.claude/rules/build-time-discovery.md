# Build-time discovery rule

Routes, islands, agents, and tools are discovered from the filesystem
at **build time**, not at request time.

- `patties build` scans `app/routes/`, `app/islands/`, `app/agents/`,
  `app/tools/`, and `app/jobs/` and inlines the discovered tables into
  the server bundle. The production server never calls `Bun.Glob` /
  `scanRoutes` / `scanIslands`.
- This is what makes Patties cold-start fast and adapter-portable
  (edge runtimes that disallow filesystem access still work).
- **Dev mode is the exception.** The dev server re-scans on file
  change to drive HMR.
- **Don't break the rule:** never write code that calls `Bun.Glob` or
  reads `app/**` at request time. If you find yourself wanting to,
  the answer is probably a build-time macro or a config option in
  `patties.config.ts`.
