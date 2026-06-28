---
spec: ui/06-badge
title: Badge
status: completed
island: false
peer_deps: ["class-variance-authority"]
last_reviewed: 2026-05-23
---

# Badge

## Purpose

Small status pill. Mirrors shadcn `Badge`.

## Island model

`island: false`. Pure presentational.

## Peer dependencies

- `class-variance-authority@^0.7`

## Public API

```ts
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

export function Badge(props: {
  variant?: BadgeVariant
  asChild?: boolean         // delegates to Slot — see _internal/slot.tsx
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLSpanElement>): JSX.Element

export const island = false
```

## Patties adjustments

- Drops `forwardRef`.
- `asChild` uses `_internal/slot.tsx` (a tiny React-19-friendly Slot).
- Renders as `<span>` by default, not `<div>`, to allow inline use without breaking flow.

## Acceptance criteria

- All four variants render the expected token classes.
- `asChild` correctly forwards classes to a single child element.
- Bundle audit: zero JS.
