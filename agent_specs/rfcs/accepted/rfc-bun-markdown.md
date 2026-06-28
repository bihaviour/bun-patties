---
rfc: bun-markdown
title: Bun.markdown — built-in MD parser for content pages
status: encoded
encoded_in: ["framework/draft/23-markdown-pages"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: 2
affects_specs: [02b-filesystem-router, 04-build, 06-client-islands, 23-markdown-pages]
bun_unique: Bun-builtin
host_subsystem: framework/draft/23-markdown-pages (.md/.mdx routes with constrained-MDX islands support)
comparable_elsewhere: `@next/mdx` + remark/rehype/unified plugin pipeline; Astro content collections; Contentlayer; Eleventy; MDXJS via `next-mdx-remote`.
---

## Review verdict (2026-05-27)

**Accept.** Content pages (blog, docs, marketing) are a recurring
template request and patties has no story for them today. The
Node-ecosystem solution stack — `@next/mdx`, `remark`, `rehype`,
`unified`, plus ~12 plugin deps — is heavy enough that frameworks
ship MDX as an opt-in package. Bun ships CommonMark + GFM in core
(`Bun.markdown`); the islands-in-markdown layer on top is a
hundred-line transformer.

The chosen scope is the **maximally-ambitious option** from the
2026-05-27 acceptance prompt — MDX with JSX-in-markdown — but
deliberately **constrained** to a v1 dialect that admits one JSX
shape: `<IslandName client:directive [literal-props] />`.
Arbitrary JSX, JS expressions, imports, and inline component
definitions are explicit non-goals for v1.

Scope pins:
- **`.md` and `.mdx` routes** picked up by the filesystem router.
- **YAML frontmatter** parsed by `Bun.YAML` (internal use; distinct
  from the deferred [[rfc-bun-config-formats]] which concerns user
  configs).
- **CommonMark + GFM** via `Bun.markdown` for body rendering.
- **Constrained MDX dialect** — only the island pattern is
  recognized as JSX.
- **Layout components** (`app/_markdown-layout.tsx` global,
  per-directory overrides).
- **Optional Zod schema** at `app/_markdown-schema.ts` for typed
  frontmatter (opt-in peer dep, same pattern as
  `@anthropic-ai/sdk`).
- **HMR** via the existing route-watcher extended to `.md/.mdx`.

Out of scope for this RFC:
- **`@mdx-js/mdx` integration** — pulling MDX as a dep defeats the
  no-dep premise. Revisit if the constrained dialect proves too
  limiting.
- **Content collections (Astro-style)** — typed collection queries
  with cross-route indexing. Separate, larger RFC.
- **Bun.markdown plugin API** — v1 uses default CommonMark + GFM
  only.

---

# RFC — Bun.markdown → first-class content pages

## Summary

`Bun.markdown(input)` parses CommonMark + GFM in-process and
returns HTML or AST. Combined with a filesystem-router extension,
a `.mdx` JSX-extraction pass, and a layout component contract,
it gives patties users a content-pages story with zero markdown
deps.

## Motivation

Every meta-framework eventually grows a content story. Next has
`@next/mdx`, Astro has content collections, Remix has MDX recipes,
SvelteKit has `mdsvex`. Patties has nothing. The barrier is the
weight of the standard solution: remark/rehype/unified is a
12-package stack that exists because Node has no markdown parser
in core.

Bun does. The patties value is the same content-pages capability
without the ecosystem tax.

## Proposal

See [[framework/draft/23-markdown-pages|spec 23]] for the full
shape. Summary:

- **Route discovery** — `app/routes/**/*.{md,mdx}` mounts as routes.
- **Frontmatter** — YAML block at top, parsed via `Bun.YAML`.
  Required field: `title`.
- **Body rendering** — `Bun.markdown(body, { gfm: true })` →
  HTML string.
- **MDX dialect (`.mdx`)** — pre-pass scans for
  `<IslandName client:directive [literal-props] />` patterns,
  replaces with HTML comment tokens, renders markdown, then
  generates a synthetic `.tsx` route that interleaves HTML
  fragments with island JSX.
- **Layouts** — `app/_markdown-layout.tsx` (global), with
  per-directory overrides.
- **Schema (optional)** — `app/_markdown-schema.ts` exports a Zod
  schema that's enforced at build time.

## Trade-offs

- **Constrained MDX is not real MDX.** Users who expect to write
  `{frontmatter.title}` in body or use arbitrary React components
  will hit the wall. Mitigation: clear build error pointing at
  the unsupported syntax + a path forward (use the layout for
  dynamic values).
- **Build-time bias.** Markdown rendering is build-time; runtime
  changes to a `.md` file require dev-mode HMR. No "render
  markdown at request time" mode in v1.
- **Optional Zod dep.** Same pattern as the AI SDK — Zod is opt-in
  peer dep; users without it lose typed frontmatter but the
  feature still works.
- **`Bun.YAML` internal use** while
  [[rfc-bun-config-formats]] is deferred. These are decoupled
  uses: frontmatter is an internal framework concern; user
  config files (the deferred RFC's domain) are user-facing.
  Using Bun.YAML in one doesn't commit to user-facing YAML config.

## Open questions

- **Per-directory layouts vs single global** — v1 walks the
  directory tree for `_markdown-layout.tsx`; matches what users
  expect from `_layout.tsx` patterns in other frameworks.
- **Code fences and syntax highlighting** — v1 emits `<pre><code>`
  without highlighting. A follow-up RFC may integrate
  Shiki/Prism via a Bun build plugin.
- **Image embedding** (`![](photo.jpg)`) — flows through the
  existing static-asset pipeline; if spec 22 is also loaded, the
  user gets srcset variants automatically.
