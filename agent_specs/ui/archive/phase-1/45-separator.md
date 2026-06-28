---
spec: ui/45-separator
title: Separator
status: completed
island: false
peer_deps: ["@radix-ui/react-separator"]
last_reviewed: 2026-05-23
---

# Separator

## Purpose

Visual or semantic divider. Mirrors shadcn `Separator`. Built on `@radix-ui/react-separator`.

## Island model

`island: false`. No JS — Radix Separator is a server-renderable primitive.

## Peer dependencies

- `@radix-ui/react-separator@^1.1`

## Public API

```ts
export function Separator(props: Radix.SeparatorProps & { className?: string }): JSX.Element
export const island = false
```

## Patties adjustments

- Removes `forwardRef`.
- `orientation` defaults to `"horizontal"`; `decorative` defaults to `true`.

## Acceptance criteria

- Decorative separator renders without `role="separator"`.
- Non-decorative separator renders `role="separator"` with `aria-orientation`.
- Bundle audit: zero JS.
