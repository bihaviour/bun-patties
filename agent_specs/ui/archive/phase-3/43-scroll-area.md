---
spec: ui/43-scroll-area
title: Scroll Area
status: completed
island: true
peer_deps: ["@radix-ui/react-scroll-area"]
last_reviewed: 2026-05-23
---

# Scroll Area

## Purpose

Cross-platform custom scrollbars over an `overflow:auto` region. Mirrors shadcn `ScrollArea`. Built on `@radix-ui/react-scroll-area`.

## Island model

`island: true`. Scrollbars are JS-driven; Radix measures content and listens to wheel/pointer.

A no-JS fallback renders native scrollbars on the `viewport` element so users without JS still get scroll.

## Peer dependencies

- `@radix-ui/react-scroll-area@^1.2`

## Public API

```ts
export function ScrollArea(props: Radix.ScrollAreaProps & { className?: string }): JSX.Element
export function ScrollBar(props: Radix.ScrollAreaScrollbarProps & { orientation?: "horizontal" | "vertical"; className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- The viewport has `overflow:auto` in the static SSR HTML so users see native scrollbars before hydration; Radix removes them by setting `overflow:hidden` post-mount.
- Removes `forwardRef`.

## Acceptance criteria

- Mouse wheel scrolls content after hydration.
- Horizontal and vertical scrollbars appear only when needed.
- Pre-hydration: native scrollbars still work.
