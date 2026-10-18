---
spec: framework/28-whole-tree-hydration
title: Whole-tree page hydration, page loaders, and the bootstrap payload
status: completed
phase: post-launch
file: src/build/page-entry.ts, src/build/index.ts, src/render/index.tsx, src/render/bootstrap.ts, src/render/shell.tsx, src/client/page.ts, src/cli/doctor/hydrate.ts
last_reviewed: 2026-10-18
rfc: patties-shadcn-whole-tree-hydration
depends_on: [framework/06-client-islands]
---

# Framework Spec 28 — Whole-tree page hydration

## Purpose

An opt-in, per-page alternative to [islands](./phase-1/06-client-islands.md):
the page's whole React subtree hydrates as **one** `hydrateRoot` over `#root`.
Function props and context shared across composed components (upstream
shadcn/ui's `<DialogTrigger>` + `<DialogContent>`) work because nothing crosses
a JSON boundary except the page's own top-level props.

Islands stay the default. A route without `hydrate` ships zero JS (or only its
island entry) exactly as before.

## Public surface

```tsx
// app/routes/dashboard/[id].tsx
export const hydrate = true; // literal boolean, read statically at build

export async function loader(req: Request, ctx: PattiesContext) {
	return { user: await db.user(ctx.params.id) }; // or return a Response
}
export const serialize = (d) => ({ ...d, at: d.at.toISOString() }); // server, optional
export const deserialize = (j) => ({ ...j, at: new Date(j.at) });   // client, optional

export default function Dashboard({ id, data }) { /* … */ }
```

```ts
// patties.config.ts
render: { hydrate: "off" | "pages" } // default "off"; "pages" ⇒ opt-out via `hydrate = false`
```

`patties/client` exports `hydratePage(Page, { root?, bootstrap?, deserialize? })`
for hand-written entries, plus `bootPage`, `navigate`, `prefetch`, `Link`
([framework/29](./29-client-navigation.md)) and `resetPageRuntime`.

## Behavior

1. **Build.** `scanHydratedPages` reads each page source with
   `Bun.Transpiler.scan` (no module evaluation). A non-literal `hydrate` export
   is a build error. For each hydrated route it writes
   `patties-gen/page-<n>-<slug>.ts` →
   `bootPage("<pattern>", { Page, deserialize? })`.
2. Islands entry + every page entry go through **one** `Bun.build`
   (`splitting: true`) so React and shared components land in common chunks.
   `process.env.NODE_ENV` is defined from the build mode (React's production
   build ships in production — this also fixed island bundles).
3. The `patties:strip-server-exports` plugin rewrites hydrated page modules
   with `Bun.Transpiler({ exports: { eliminate: ["loader", "serialize"] },
   trimUnusedImports: true })`, so server-only imports never reach the browser.
   Bare imports the transpiler leaves behind are dropped unless authored.
4. `manifest.pages[bunPattern]` holds the page chunk URL; presence there is
   what marks a route hydrated at request time. `BuildResult.clientBytes`
   reports each route's entry + static-import closure; `patties build` prints it.
5. **Render.** `loader(req, ctx)` runs for any page that exports it; its result
   is the `data` prop (a returned `Response` short-circuits). Hydrated pages
   also emit `<script type="application/json" id="__patties_bootstrap">` with
   `{ params, data? }` (after `serialize`) outside `#root`, and their module
   script is the page chunk instead of the island entry. `Vary: x-patties-nav`.
6. **Client.** `bootPage` hydrates once per document with
   `{ ...params, data: deserialize(data) }` — byte-for-byte the server's props.

## Precedence with islands

Whole-tree wins: a hydrated page loads only its page chunk; `<Island>` markers
inside it render and hydrate as part of the tree, so they are redundant.
`patties doctor` warns (`hydrate-islands`) and fails on a non-literal export.

## Constraints

- Build-time discovery holds: the server bundle still inlines the route table;
  no runtime scan (`tests/integration/hydrate.test.ts`).
- SSR must be deterministic for hydrated pages (use `useId`, not `Math.random`).
- Works on `bun` and `edge` targets; `adapter.bun.compile` embeds page chunks
  through the existing client-chunk path.

## Tests

`tests/build/page-entry.test.ts`, `tests/integration/hydrate.test.ts` (bun +
edge), `tests/client/page-runtime.test.tsx` (happy-dom: no mismatch,
context + function props, soft navigation), `tests/cli/doctor-hydrate.test.ts`.
