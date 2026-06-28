---
spec: ui/48-skeleton
title: Skeleton
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Skeleton

## Purpose

Loading placeholder shape. Mirrors shadcn `Skeleton`.

## Island model

`island: false`. CSS-only shimmer animation.

## Peer dependencies

None.

## Public API

```ts
export function Skeleton(props: React.ComponentProps<"div">): JSX.Element
export const island = false
```

## Patties adjustments

- The shimmer uses `@keyframes` defined in `tokens.css` so no JS animation library is needed.
- `prefers-reduced-motion` disables the animation.

## Acceptance criteria

- Snapshot matches a `<div>` with the skeleton classes.
- Bundle audit: zero JS.
- Reduced-motion: animation is `none`.
