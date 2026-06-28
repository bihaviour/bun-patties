---
spec: framework/03-render
title: Server Render
status: completed
phase: 0
file: server/render.tsx
last_reviewed: 2026-05-23
---

# Spec 03 — Server Render

## Purpose

Render page route modules to HTML using React (`react-dom/server`). Stream the response by default; the renderer always returns a `ReadableStream`-backed `Response`.

## Public surface

```ts
export interface Renderer {
  renderPage(entry: RouteEntry, req: Request, ctx: PattiesContext): Promise<Response>
}

export function createRenderer(options: RenderOptions): Renderer
```

`PattiesContext` is defined in [07-middleware](../phase-1/07-middleware.md). The renderer never sees a Hono `Context` — the framework has no HTTP framework dependency.

`RenderOptions`:
- `manifest?: ClientManifest` — produced by [04-build](../phase-1/04-build.md); maps island name → bundled URL. Optional in pure-SSR contexts.
- `dev?: boolean` — when true, inject the HMR client script.

## Behavior

1. `import(entry.filePath)`; the module's default export is the page component.
2. Compute initial props (none in Phase 0; future RFC for loaders).
3. Read the page module's optional `head` / `meta` named exports (see "Head & meta API" below) and build the `<head>` contents.
4. Call `renderToReadableStream` from `react-dom/server` (the Web Streams variant — never `renderToPipeableStream`, which is Node-only) wrapped in an `<html>` shell that:
   - Includes the document `<head>` (title, meta, viewport, plus user-provided `head`/`meta`).
   - Mounts `<div id="root">` containing the rendered tree.
   - Always injects `<script type="module" src="/_patties/client/<entry>.js">` referencing the client entry from [04-build](../phase-1/04-build.md). The entry is a no-op at runtime when the page rendered no `data-island` markers, so pages with zero islands ship the script tag but it short-circuits.
   - If `dev`, injects an inline `<script>` that opens the HMR WebSocket from [05-dev-hmr](../phase-1/05-dev-hmr.md). **Implementation note:** React 19's `renderToReadableStream` already emits `<!DOCTYPE html>` when the rendered root is `<html>` — framework code MUST NOT prepend its own DOCTYPE (doing so produces `<!DOCTYPE html><!DOCTYPE html>...`). The dev HMR `<script>` should be spliced in by a downstream `TransformStream` that inserts the snippet immediately before `</body>`, rather than through React's raw-HTML escape hatch — this keeps a fixed framework string out of the React tree and side-steps the lint/safety rules that flag that escape hatch. Phase 2 will replace the splice with the HTMLRewriter pipeline ([[rfc-bun-htmlrewriter]]).
5. Return `new Response(stream, { headers: { "Content-Type": "text/html; charset=utf-8" } })`. Crawler/SEO routes may `await stream.allReady` first to emit fully-buffered HTML; the default path streams as soon as the shell is ready.

JSX is configured via `tsconfig.json` (`"jsx": "react-jsx"`, `"jsxImportSource": "react"`). Pages import JSX implicitly through `react/jsx-runtime`; no manual `import React` is required.

## Head & meta API

Page modules may export, alongside the default component:

```ts
export const meta = {
  title: "Bali Hotels",
  description: "Find a place to stay in Bali.",
  // any additional <meta name|property> pairs as a record
}

// OR — full control:
export function head(): import("react").ReactNode {
  return <>
    <title>Bali Hotels</title>
    <link rel="canonical" href="https://example.com/bali" />
  </>
}
```

Rules:
- `meta` is the static, AGENTS.md-friendly form. It produces `<title>`, `<meta name="description">`, and `<meta name|property="…">` tags deterministically.
- `head` is escape-hatch JSX rendered into `<head>` — used when `meta` can't express what the page needs (canonical links, OpenGraph images, JSON-LD).
- If both are exported, `meta` runs first; `head`'s output appears after, so users can override generated tags.
- If neither is exported, the renderer emits a minimal `<head>` (charset, viewport, `<title>` defaulting to the URL path).

## Island awareness

Pages that import from `app/islands/*` must serialize each island's mount point with `data-island="<name>"` and serialized props as JSON. The runtime client ([06](../phase-1/06-client-islands.md)) reads these markers.

Island presence is determined at **build time** by scanning `app/islands/` and statically analyzing page imports — not by inspecting rendered JSX. The renderer therefore does not need to walk the tree to detect islands; it relies on the build manifest.

## Dev error UX

When `dev: true` and a page module fails to import or render (syntax error, runtime throw), the renderer catches the failure and returns a styled HTML error page built from Bun primitives:

- **Error formatting**: `Bun.inspect(error, { colors: false })` produces a clean text rendering of the error and its `.cause` chain. The renderer wraps it in `<pre>` for the page.
- **Source snippets**: read via `Bun.file(stackFrame.file).text()`, then 5 lines of context around the failing line. The snippet is escaped with **`Bun.escapeHTML`** before injection — error messages and source can contain `<script>` and must not become an XSS hole on the dev page.
- **Open in editor**: each stack frame renders as a clickable link to a `/__patties_open?file=...&line=...` route. That route calls `Bun.openInEditor(file, { line })` and returns `204`. One-click jump from the error page to the offending line in VS Code / Cursor / etc.
- **Reload hint**: a footer line tells the user the page is HMR-connected and will refresh when the file is fixed.

In production (`dev: false`) the same failure returns a minimal `500 Internal Server Error` with no stack content and no source.

## Non-goals

- Legacy `renderToString` — not used; we stream by default.
- `renderToPipeableStream` (Node Writable streams) — not used; we target WinterCG/Web Streams runtimes.
- React Server Components — out of scope until Bun.build understands the `"use client"` directive. Islands remain the interactivity model.
- Phase 2 will move shell injection (HMR script, client `<script>`, CSRF input) into an `HTMLRewriter` pipeline. See [[rfc-bun-htmlrewriter]]. Phase 0/1 keeps the documented string-injection approach.

## Acceptance criteria

- Rendering a static page returns valid HTML with `Content-Type` set and a leading `<!DOCTYPE html>` — emitted exactly once. The renderer must not produce `<!DOCTYPE html><!DOCTYPE html>` (React 19 already prepends the doctype when the root is `<html>`).
- Rendering a page containing one `Counter` island emits exactly one `data-island="Counter"` marker plus a serialized props blob.
- In `dev` mode, the HTML includes the HMR client snippet, and React emits no hydration-mismatch warnings for the default fixtures.
