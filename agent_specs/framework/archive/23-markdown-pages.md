---
spec: framework/23-markdown-pages
title: Markdown pages — .md/.mdx routes with islands-in-markdown
status: accepted (implementation pending)
phase: 2
file: src/build/, src/router/, src/render/
last_reviewed: 2026-05-27
supersedes: framework/archive/phase-0/02b-filesystem-router (extends — adds .md/.mdx route discovery), framework/archive/phase-1/04-build (extends — adds markdown-to-React build pass)
rfc: rfc-bun-markdown
---

# Spec 23 — Markdown pages

This spec encodes [[rfc-bun-markdown]]. Mount `.md` and `.mdx` files
in `app/routes/` as React-rendered pages. Frontmatter parses to a
typed object; markdown body renders via `Bun.markdown`; a constrained
MDX dialect supports embedding patties islands inline.

The patties value: **first-class content pages without
@next/mdx + remark + rehype + unified + ~12 plugin deps.** Bun
ships the CommonMark parser in core; the islands-in-markdown layer
is a hundred-line transformer.

## Goal

A user creates `app/routes/about.md` with frontmatter, writes
markdown, and `GET /about` renders a fully-SSRed page wrapped in
their layout. Switching to `.mdx` lets them embed island components
(`<Counter client:load />`) in the body without any other change.

## Surface

### File convention

```
app/routes/
  index.tsx              # GET /
  about.md               # GET /about      ← new
  blog/
    index.tsx            # GET /blog
    hello-world.mdx      # GET /blog/hello-world  ← new
app/_markdown-layout.tsx # default layout for all .md / .mdx routes
```

### Frontmatter

```markdown
---
title: About patties
description: Why we built this
date: 2026-05-27
draft: false
---

# About

Patties is a Bun-native meta-framework...
```

Frontmatter is parsed as YAML via `Bun.YAML` (internal use; this is
distinct from the deferred [[rfc-bun-config-formats]] which concerns
user-facing `patties.config.*` files). Required fields:

- `title: string`

All other fields are user-defined and flow through to the layout as
typed props. Type safety via an opt-in Zod schema at
`app/_markdown-schema.ts` if present.

### Layout component

```tsx
// app/_markdown-layout.tsx
import type { MarkdownPageProps } from "patties/render"

export default function MarkdownLayout({ frontmatter, children, slug }: MarkdownPageProps) {
  return (
    <html>
      <head><title>{frontmatter.title}</title></head>
      <body>
        <header>...</header>
        <article>{children}</article>
        <footer>...</footer>
      </body>
    </html>
  )
}

export type MarkdownPageProps = {
  frontmatter: { title: string; [key: string]: unknown }
  children: React.ReactNode
  slug: string  // route path
}
```

Per-directory layouts via `app/routes/<dir>/_markdown-layout.tsx`
override the global. Resolution walks up the directory tree from the
markdown file, picking the nearest layout.

## Build behaviour

### Discovery

Filesystem-router scan ([[framework/archive/phase-0/02b-filesystem-router|spec 02b]])
is extended to recognize `.md` and `.mdx` files. Resolution
priority: `.tsx` > `.ts` > `.mdx` > `.md` when multiple files would
match the same route.

### Markdown transform (`.md`)

1. Split file at the first `---` block boundary: frontmatter + body.
2. Parse frontmatter via `Bun.YAML`.
3. Render body via `Bun.markdown(body, { gfm: true })` → HTML string.
4. Validate frontmatter against `app/_markdown-schema.ts` if present.
5. Emit a synthetic route module
   `.patties/routes/markdown/<slug>.tsx`:

```tsx
// generated
import Layout from "<resolved layout>"
import { Fragment } from "react"

const FRONTMATTER = { /* parsed object */ } as const
const HTML = `<rendered HTML>`

export default function Page() {
  return (
    <Layout frontmatter={FRONTMATTER} slug="<route>">
      <div dangerouslySetInnerHTML={{ __html: HTML }} />
    </Layout>
  )
}
```

The synthetic file is what the router compiles to a `Bun.serve`
route entry — markdown files are invisible to the router after the
build pass.

### MDX transform (`.mdx`) — constrained dialect

`Bun.markdown` does not parse JSX. The framework adds a thin
**island-extraction** pass that runs before markdown rendering. v1
supports exactly one JSX shape:

```
<IslandName client:directive [prop="..." | prop={number} | prop={true}] />
```

Where:

- `IslandName` must resolve to a component exported from
  `app/islands/<IslandName>.tsx`.
- `client:directive` is one of `client:load`, `client:idle`,
  `client:visible`, `client:media={"(min-width: 768px)"}`.
- Props are limited to string literals, numeric literals, boolean
  literals — **no JS expressions** (e.g. `{frontmatter.title}` is
  not supported in body; pass dynamic values through the layout).
- Self-closing only. No children. No nesting.

Pass implementation:

1. Scan body for matches of the island pattern (one regex).
2. Replace each with a unique HTML comment token:
   `<!--ISLAND:0-->`, `<!--ISLAND:1-->`, ...
3. Run `Bun.markdown` on the body-with-tokens — comments survive
   the parser as-is.
4. Generate the synthetic route module with the island list:

```tsx
// generated
import Layout from "..."
import Counter from "../islands/Counter"
import Subscribe from "../islands/Subscribe"

const FRONTMATTER = { /* ... */ }
const ISLANDS = [
  { component: Counter,   props: {}, directive: "load" },
  { component: Subscribe, props: { variant: "hero" }, directive: "visible" },
]
const HTML_PARTS = ["<p>Welcome...</p>", "<p>Read more...</p>"]

export default function Page() {
  return (
    <Layout frontmatter={FRONTMATTER} slug="...">
      {interleave(HTML_PARTS, ISLANDS)}
    </Layout>
  )
}
```

`interleave` is a framework helper that splits HTML on the
`<!--ISLAND:N-->` markers and weaves in island JSX between
fragments. It's pure-server JSX; islands hydrate per their existing
spec-06 lifecycle.

### Validation errors

Frontmatter parse failure, schema mismatch, missing island
component, or unsupported JSX in body → **build fails** with a
file:line:column error pointing at the offending `.md` / `.mdx`
source. No silent renders.

## Runtime behaviour

Once the synthetic route is generated, runtime is identical to a
hand-written `.tsx` route. SSR, islands hydration, HMR all use
existing spec-04/05/06 paths.

## Dev mode (HMR)

The filesystem watcher already picks up `.tsx` changes (spec 05).
Add `.md` / `.mdx` to the watched extensions: on change, re-run the
transform pass for the single file and notify the HMR socket. The
synthetic `.patties/routes/markdown/<slug>.tsx` updates; the
existing HMR system picks it up like a route file change.

## Frontmatter typing

Without a schema file, `frontmatter` is typed as
`{ title: string; [key: string]: unknown }` — users cast or check
at the layout level.

With `app/_markdown-schema.ts`:

```ts
import { z } from "zod"
export default z.object({
  title: z.string(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
})
```

Build-time validation parses each file's frontmatter through the
schema and **fails the build** on mismatch. The layout's
`frontmatter` prop is typed as `z.infer<typeof schema>`.

(Note: zod is an optional peer dep — same pattern as
`@anthropic-ai/sdk`. The schema file is only loaded if present.)

## Security model

The spec uses `dangerouslySetInnerHTML` to inject the
markdown-rendered HTML. This is **safe under the build-time trust
model** spelled out below — but the model has hard edges. Failing
to respect them creates an XSS hole.

### Trust model (v1)

`.md` and `.mdx` files in `app/routes/` are **developer-controlled
source code**, not runtime user input. They live in the repository,
are reviewed by humans, and get rendered at build time. The HTML
emitted by `Bun.markdown` is bundled into the synthetic route
module — there is no request-time markdown rendering of
user-supplied content via this spec.

Under this model, `dangerouslySetInnerHTML` is acceptable because
its input is no more privileged than any other code the developer
wrote.

### Hard edges (do not do)

The trust model breaks if any of these patterns appears:

- **Runtime markdown rendering of user input.** A handler that
  calls `Bun.markdown(req.body)` and pipes the result into
  `dangerouslySetInnerHTML` is an XSS vulnerability — even if the
  surrounding page came from this spec. Users who need to render
  user-supplied markdown must sanitize the HTML first (e.g.
  DOMPurify, or restrict `Bun.markdown` to a no-raw-HTML mode if
  Bun exposes one).
- **Including user-uploaded markdown in `app/routes/`** via a
  build-time content sync. Anything that puts attacker-influenceable
  bytes into the build input retroactively undermines the
  "developer-controlled" assumption.

### Framework defenses

The framework MUST:

- **Disable raw HTML pass-through in `Bun.markdown` by default** —
  invoke as `Bun.markdown(body, { gfm: true, html: false })` (or
  the equivalent option Bun exposes) so that inline `<script>` /
  `<iframe>` / `<img onerror>` in a `.md` file are escaped to text,
  not rendered. A developer can opt back in per-file via a
  frontmatter flag (`unsafeHtml: true`) — that flag is the audit
  trail.
- **Validate the `IslandName` in the MDX extraction pass against
  the actual exports of `app/islands/`**. Don't accept arbitrary
  component names from `.mdx` source — only names that resolve to
  a file in the islands directory. This stops a typo or malicious
  edit from instantiating an unintended component.

### Documentation requirement

The user-facing docs for this feature MUST state, in the
introductory section, that markdown pages are build-time content
and that runtime user-markdown requires explicit sanitization.

## Non-goals

- **Arbitrary JSX in markdown.** v1 supports only the island
  pattern. Custom React components, JS expressions, and full MDX
  semantics are explicit non-goals.
- **`@mdx-js/mdx` integration.** Pulling in MDX as a dep defeats
  the "no-deps" premise. If the constrained dialect proves too
  limiting, a follow-up RFC can revisit.
- **Imports inside markdown.** No `import` statements in body.
- **Components defined inline in MDX.** No `export const Foo = ...`
  in body.
- **Bun.markdown plugin/extension API.** v1 uses Bun.markdown's
  default CommonMark + GFM; no remark-style plugin pipeline.
- **Content collections.** Astro-style typed collections with
  query APIs are out of scope. Future RFC can layer on top.

## Acceptance criteria

- `app/routes/about.md` with frontmatter renders at `GET /about`,
  wrapped in `app/_markdown-layout.tsx`, with body markdown
  converted to HTML.
- `app/routes/blog/post.mdx` with
  `<Counter client:load />` in the body SSRs the surrounding
  markdown + hydrates the Counter island when JS loads.
- Frontmatter parse failure stops the build with a clear error.
- `app/_markdown-schema.ts` enforces schema at build; mismatched
  frontmatter fails the build.
- Per-directory `_markdown-layout.tsx` overrides the global.
- HMR on `.md` / `.mdx` save updates the rendered page without a
  full reload.

## Test plan

- Unit: extract frontmatter + body from a sample file.
- Unit: Bun.markdown integration — assert HTML output for known
  CommonMark fixtures.
- Unit: island-extraction regex — match supported patterns; reject
  unsupported (e.g. JS expression props).
- Integration: build a fixture with `.md` + `.mdx` routes →
  assert synthetic route modules emitted.
- Integration: full SSR of `.mdx` page → assert HTML structure +
  island markers present for hydration.
- Negative: malformed frontmatter, missing island import → assert
  build error message includes file + position.

## Out of this spec

- Sitemap / RSS generation from markdown frontmatter — separate
  RFC.
- Image embedding (`![](photo.jpg)`) gets resolved by the existing
  static-asset pipeline (spec 22 if Image is loaded for the route).
  No special markdown-image handling beyond passing the URL through.
- Tag indexes / collection queries — out of scope; see Non-goals.
