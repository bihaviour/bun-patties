---
"patties": minor
---

Add opt-in whole-tree page hydration (`export const hydrate = true`, or `render: { hydrate: "pages" }`): the page's whole React tree hydrates as one root from a `__patties_bootstrap` payload, so function props and shared context work. Pages can export `loader(req, ctx)` (plus optional `serialize`/`deserialize`); server-only exports are stripped from client bundles. Adds client-side navigation between hydrated pages (`Link`, `navigate`, `prefetch` from `patties/client`), per-route client-bytes reporting in `patties build`, and a `patties doctor` check for pages mixing `<Island>` with `hydrate`. Client bundles now define `NODE_ENV`, so production builds ship React's production build. Routes without `hydrate` are unchanged.
