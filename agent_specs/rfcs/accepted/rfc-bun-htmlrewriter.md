---
rfc: bun-htmlrewriter
title: HTMLRewriter — streaming HTML transforms for SSR + edge
status: encoded
encoded_in: ["framework/phase-0/03-render"]
encoded_on: 2026-05-24
verdict: accept-phase-2
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: 2
affects_specs: [03-render, 06-client-islands, 12-edge-adapters]
---

## Review verdict (2026-05-24)

**Accept, Phase 2 — not blocking Phase 0/1.** Architecturally correct (same API on Bun and Workers). The "unlocks streaming SSR" framing in the summary is overstated — `renderToReadableStream` is already streaming and the shell injection happens around it, not inside it. The real wins are: (1) safer than string concat against minified shells, (2) becomes the prerequisite for [[rfc-bun-csrf]]'s renderer auto-injection of CSRF inputs, (3) cleaner extension point for user-supplied rewriters.

Phase 0/1 spec 03 stays with the documented string-injection approach until this lands.

---

# RFC — HTMLRewriter integration

## Summary
`HTMLRewriter` is Bun's (and Cloudflare's) streaming HTML rewriter. It transforms HTML as a `Response` body streams through it, without buffering. Patties should use it for the dev HMR script injection, island bootstrap markup, and any user-defined response transforms — replacing today's string-concat injection.

## Motivation
03-render currently concatenates `<script>` tags onto the rendered HTML string before returning a Response. That:
1. forces full buffering (defeats React streaming SSR),
2. requires careful `</body>` matching that breaks on minified shells,
3. duplicates work for the edge adapter (12).

`HTMLRewriter` lets us declare "inject this script before `</body>`" and "set this attribute on `<html>`" as element handlers and stream the result. It's the same API on Bun and on Cloudflare Workers, so 12-edge gets it for free.

## Proposal
- 03-render: replace the string-injection path with an `HTMLRewriter` pipeline. The renderer produces a Response from `react-dom/server.renderToReadableStream`, then pipes through one rewriter that adds the HMR script (dev) and island bootstrap.
- 06-islands: island hydration script becomes an HTMLRewriter element handler attached to elements with `data-island`.
- 12-edge-adapters: document that the same rewriter ships unchanged to Cloudflare/Workerd.

Sample:
```ts
const rewriter = new HTMLRewriter()
  .on("body", { element(el) { el.append(hmrScript, { html: true }); } });
return rewriter.transform(ssrResponse);
```

## Trade-offs
- Adds a streaming transform stage — slightly higher per-request overhead than a string concat, but unlocks streaming SSR.
- Non-Bun, non-CF runtimes (Vercel Node) need a polyfill — adapter problem, not core.

## Open questions
- Order of rewriters when users add their own (middleware extension point)?
- Does `HTMLRewriter` interact correctly with React's `<Suspense>` boundary chunks? Needs a streaming benchmark.
