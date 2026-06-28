---
rfc: bun-html-imports
title: Bun fullstack HTML imports — evaluate as alternative build path
status: deferred
verdict: reject-for-v1
opened: 2026-05-23
reviewed: 2026-05-24
target_phase: post-1.0
affects_specs: [04-build, 06-client-islands, 05-dev-hmr]
---

## Review verdict (2026-05-24)

**Reject for v1; keep as future-work RFC.** The RFC itself frames the right question — "is there any phase 0–4 use case that needs this?" — and answers it correctly: the custom pipeline is sufficient. Two HMR systems in dev (Bun's HTML-import HMR plus Patties' WebSocket-based HMR) would create confusing failure modes during the v1 stabilization window.

Revisit when:
- The Patties pipeline is stable and the team has bandwidth to support a second rendering mode.
- A concrete use case appears that the SSR+islands pipeline doesn't cover (likely candidate: developer marketing pages bundled as static-with-islands shipped via the same project).

**Re-evaluation trigger (added 2026-05-27):** [[framework/17-dev-island-bundler]] and [[framework/18-dev-island-bundler-impl]] introduce a hand-rolled dev-time `Bun.build` invocation in `src/dev/bundler.ts`. HTML imports could replace that module with effectively a one-liner. After spec 18 has been in users' hands for one release cycle without major bug reports, re-open this RFC and compare maintenance cost of `src/dev/bundler.ts` vs. running Bun's HTML-import HMR alongside the existing WebSocket HMR.

No spec changes. File preserved as `status: deferred`.

---

# RFC — `import index from "./index.html"` fullstack mode

## Summary
Bun supports passing HTML files directly to `Bun.serve`'s `routes:` (e.g. `"/": homepage` where `homepage` is the result of `import homepage from "./index.html"`). The bundler walks `<script>` and `<link>` tags, bundles the graph, and serves with native HMR. This is Bun's blessed fullstack pattern.

## Motivation
04-build and 06-islands implement a from-scratch bundle pipeline: scan islands, call `Bun.build`, write manifest, inject scripts at render time. Bun's HTML-import mode would replace large parts of that with a one-liner. Worth evaluating — not necessarily adopting — because the hand-rolled pipeline gives us more control (per-route island manifests, dev/prod parity for SSR).

## Proposal
- Spike: a parallel `app/html/**/*.html` convention where each HTML file is a single-page entry consumed by `Bun.serve` via HTML import. Useful for marketing pages, admin tools, status pages — places where SSR + islands is overkill.
- Document trade-offs in 04-build: HTML import = no SSR, full Bun-managed HMR; existing pipeline = SSR + islands + custom manifest.
- 05-dev-hmr: if we adopt HTML imports anywhere, the dev server hosts *two* HMR systems (Bun's + ours). Either unify or namespace by URL prefix.

## Trade-offs
- Two build pipelines = two mental models. Could be confusing.
- Bun's HMR for HTML imports doesn't cooperate with React Server Components or streaming SSR — adoption forces a "pick a rendering mode per route" story.

## Open questions
- Does any phase 0–4 use case actually need this, or is custom-pipeline sufficient for v1?
- If we adopt it, do we deprecate the custom client bundler or keep both?
