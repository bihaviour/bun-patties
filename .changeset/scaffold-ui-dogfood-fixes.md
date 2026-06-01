---
"create-patties": patch
---

Fix scaffold UX gaps surfaced by dogfooding the UI + `/patties-init` flow:

- **Wire Tailwind for UI projects.** A `--ui` scaffold previously rendered
  unstyled — `app/styles/app.css` was written but never compiled or linked. Now
  the scaffolder ships a `css` script (`@tailwindcss/cli`, run by `dev`/`build`),
  a `app/routes/api/styles.ts` route that serves the compiled sheet, and a shared
  `app/components/_head.tsx` each page re-exports so styles load in dev and the
  compiled binary alike. The generated CSS is gitignored.
- **Typecheck cleanly out of the box.** A fresh app failed `tsc --noEmit`: the
  `tsconfig` lacked `allowImportingTsExtensions`/`noEmit` (every `.ts`/`.tsx`
  extension import errored TS5097), and templates used the global `JSX.Element`
  namespace that React 19 removed (TS2503). Both fixed, plus a `typecheck` script
  and a `css` module type for the stylesheet import.
- **`/patties-init` starts clean.** The command now removes the placeholder
  TodoApp demo before scaffolding the first real feature, and carries the stable
  framework constraints (pages get only `ctx.params`; `.ts` routes live under
  `api/`; middleware gates pages; styling is opt-in per page) so the agent
  doesn't re-derive them from source. The `/patties` recipes encode the same.
- **Ignore build output.** `patties-gen` (written at build time) is now in the
  default gitignore.
