---
spec: ui/22-direction
title: Direction Provider
status: completed
island: false
peer_deps: ["@radix-ui/react-direction"]
last_reviewed: 2026-05-23
---

# Direction Provider

## Purpose

LTR/RTL provider that Radix components read. Mirrors shadcn `Direction` (which simply re-exports Radix's `DirectionProvider`).

## Island model

`island: false`. It's a Context provider that renders synchronously on the server. Children inherit the direction during SSR; client islands re-read on hydration.

## Peer dependencies

- `@radix-ui/react-direction@^1.1`

## Public API

```ts
export function DirectionProvider(props: {
  dir: "ltr" | "rtl"
  children?: React.ReactNode
}): JSX.Element

export const island = false
```

## Patties adjustments

- Recommended placement: in the root layout, around the page tree, with `dir` driven by the request locale (read from a Patties middleware).
- Also sets `dir` on the nearest `<html>` element via a server-side prop so CSS `:dir()` selectors work without JS.

## Acceptance criteria

- SSR `<html dir="rtl">` is emitted when locale is RTL.
- Nested Radix components (Menu, Slider, etc.) flip their arrow-key semantics in RTL.
- Bundle audit: zero JS contribution beyond Radix's tiny context module.
