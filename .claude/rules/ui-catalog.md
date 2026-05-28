# UI catalog rule

`packages/patties-ui` is the shadcn-compatible, **copy-in** component catalog. `patties add <component>` stamps source into the user's `app/components/ui/` — components are never imported from a versioned npm package. All 60 components ship (`status: "completed"`).

- **Registry is the source of truth.** `src/registry.ts` (typed by `src/types.ts`) is what the CLI reads. A template under `templates/` only becomes stampable once it has a `registry.ts` entry with `status: "completed"`. Edit the registry, not just the template dir.
- **SSR-first, island by opt-in.** Every component file exports `island: true | false | "subtree"` so the build can decide whether to ship it to the client. Static-by-default; `"subtree"` is a static shell inheriting a nested island. No top-level `window` / `document` / `process` access.
- **`patties add` is CI-safe and Bun-native.** It refuses to run under `NODE_ENV=production`, and **never** runs `npm/bun install` — it edits `package.json` and tells the user to run `bun install`. Destination is fixed (`app/components/ui/`, helpers in `_internal/`); there is no `components.json` — config is convention.
- **React 19 style.** No `forwardRef`; refs are plain props. Radix-class primitives via the unified `radix-ui` import. Theming is Tailwind v4 + CSS variables in `app/styles/tokens.css`, dark mode by `.dark` on `<html>` with no JS theming dep.
- **Specs** live in the sibling `bun-patties-docs` repo under `agent_specs/ui/archive/` (phases 0–4, all archived); `00-overview.md` is the catalog index. Parity against upstream shadcn is tracked in `agent_specs/research/patties-ui-parity-matrix.md`.
