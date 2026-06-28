---
spec: ui/51-spinner
title: Spinner
status: completed
island: false
peer_deps: ["lucide-react"]
last_reviewed: 2026-05-23
---

# Spinner

## Purpose

Inline loading spinner. Mirrors shadcn `Spinner`.

## Island model

`island: false`. CSS animation only.

## Peer dependencies

- `lucide-react@^0.400` (Loader2)

## Public API

```ts
export function Spinner(props: { size?: "sm" | "default" | "lg"; className?: string } & React.SVGAttributes<SVGSVGElement>): JSX.Element
export const island = false
```

## Patties adjustments

- Uses `lucide-react`'s `Loader2` icon spun with Tailwind `animate-spin`.
- Reduced-motion: animation is `none` (the icon stays static).

## Acceptance criteria

- Three sizes render at 16/20/24 px.
- Bundle audit: zero JS contribution.
- Reduced-motion respected.
