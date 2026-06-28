---
spec: ui/28-hover-card
title: Hover Card
status: completed
island: true
peer_deps: ["@radix-ui/react-hover-card"]
last_reviewed: 2026-05-23
---

# Hover Card

## Purpose

Lazy popover on hover/focus — for previews. Mirrors shadcn `HoverCard`. Built on `@radix-ui/react-hover-card`.

## Island model

`island: true`. Hover timing and portal mounting need JS.

## Peer dependencies

- `@radix-ui/react-hover-card@^1.1`

## Public API

```ts
export const HoverCard: typeof Radix.Root
export const HoverCardTrigger: typeof Radix.Trigger
export function HoverCardContent(props: Radix.HoverCardContentProps & { className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- `openDelay` defaults to `200ms` and is configurable per-component, not globally.

## Acceptance criteria

- Hovering or focusing the trigger reveals content after `openDelay`.
- Touch devices fall back to no-op (Radix default) — no flashing on tap.
- SSR renders only the trigger.
