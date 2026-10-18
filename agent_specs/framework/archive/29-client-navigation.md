---
spec: framework/29-client-navigation
title: Client-side navigation between hydrated pages
status: completed
phase: post-launch
file: src/client/page.ts, src/client/link.tsx, src/render/index.tsx, src/render/bootstrap.ts
last_reviewed: 2026-10-18
depends_on: [framework/28-whole-tree-hydration]
---

# Framework Spec 29 — Client-side navigation

## Purpose

Move between [hydrated pages](./28-whole-tree-hydration.md) without a full
document load (GitHub issue #37: console screens realm → clients → client).
Builds on the page `loader()` and bootstrap payload — no second data API.

## Public surface

```tsx
import { Link, navigate, prefetch } from "patties/client";

<Link href="/realms/acme/clients">Clients</Link>   // prefetch="intent" by default
await navigate("/realms/acme", { replace: true });
```

`Link` renders a plain `<a>`, so it SSRs and degrades to normal navigation on
zero-JS and island pages.

## Behavior

1. A request carrying `x-patties-nav: 1` to a page route runs middleware and
   `loader()` as usual but answers JSON instead of HTML:
   `{ hydrated: true, route, script, bootstrap: { params, data? }, title? }`,
   or `{ hydrated: false }` for a route without a page bundle.
2. `Link` intercepts unmodified primary clicks (no modifier keys, no
   `target`/`download`) when the document booted a hydrated page and the target
   is same-origin. Hover/focus warms the payload and chunk (`prefetch`).
3. `navigate` fetches the payload (following redirects — the final URL goes in
   the address bar), `import()`s the page chunk unless already registered,
   pushes history, sets `document.title` from `meta.title`, and calls
   `root.render(<Page key={route} {...props} />)` on the existing root. Moving
   between routes remounts; a param change within one route keeps state.
4. `popstate` re-runs `navigate` without touching history; scroll goes to the
   hash target or the top on push.
5. Anything unhandled — `hydrated: false`, a non-JSON or non-OK response, a
   chunk load failure — falls back to `location.assign`, so navigation always
   succeeds.

## Non-goals

`head()` nodes other than the title are not swapped on soft navigation; nested
layouts and parallel data loading are future work.

## Tests

`tests/client/page-runtime.test.tsx`, `tests/integration/hydrate.test.ts`
(nav payloads on bun + edge).
