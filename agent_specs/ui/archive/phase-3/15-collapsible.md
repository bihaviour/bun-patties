---
spec: ui/15-collapsible
title: Collapsible
status: completed
island: true
peer_deps: ["@radix-ui/react-collapsible"]
last_reviewed: 2026-05-23
---

# Collapsible

## Purpose

Single show/hide region — lower-level than Accordion. Mirrors shadcn `Collapsible`. Built on `@radix-ui/react-collapsible`.

## Island model

`island: true`. Open state and `aria-expanded` need client JS.

## Peer dependencies

- `@radix-ui/react-collapsible@^1.1`

## Public API

```ts
export const Collapsible: typeof Radix.Root
export const CollapsibleTrigger: typeof Radix.Trigger
export function CollapsibleContent(props: Radix.CollapsibleContentProps & { className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- SSR honors `defaultOpen` so the initial markup matches the post-hydration state — no hydration mismatch.

## Acceptance criteria

- `defaultOpen` renders the content visible on the server.
- Trigger toggles `data-state="open"|"closed"` and the height transition runs after hydration.
- `prefers-reduced-motion` disables the transition.
