---
spec: ui/04-aspect-ratio
title: Aspect Ratio
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Aspect Ratio

## Purpose

Holds a child at a fixed width:height ratio. Mirrors shadcn `AspectRatio`. Upstream uses `@radix-ui/react-aspect-ratio`; Patties ships a tiny CSS-only equivalent since modern browsers support `aspect-ratio`.

## Island model

`island: false`. Pure CSS — no JS.

## Peer dependencies

None. (We deliberately drop `@radix-ui/react-aspect-ratio` because `aspect-ratio` CSS is universally supported in our edge runtime targets.)

## Public API

```ts
export function AspectRatio(props: {
  ratio?: number          // default 1
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}): JSX.Element

export const island = false
```

Implementation: a `<div>` with `style={{ aspectRatio: String(ratio) }}` and `position: relative`. Children are absolutely positioned via a wrapper.

## Patties adjustments

- Removes the Radix dependency.
- `ratio` accepts any positive number; an invalid `ratio` falls back to `1`.

## Acceptance criteria

- Snapshot SSR renders `style="aspect-ratio:16/9; position:relative"` when `ratio={16/9}`.
- Bundle audit: zero JS shipped.
- Renders correctly inside flex/grid parents with `width: 100%`.
