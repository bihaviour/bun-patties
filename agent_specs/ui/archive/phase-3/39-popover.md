---
spec: ui/39-popover
title: Popover
status: completed
island: true
peer_deps: ["@radix-ui/react-popover"]
last_reviewed: 2026-05-23
---

# Popover

## Purpose

Floating panel anchored to a trigger. Mirrors shadcn `Popover`. Built on `@radix-ui/react-popover`.

## Island model

`island: true`. Positioning, open-state, and focus management need client JS.

## Peer dependencies

- `@radix-ui/react-popover@^1.1`

## Public API

```ts
export const Popover: typeof Radix.Root
export const PopoverTrigger: typeof Radix.Trigger
export const PopoverAnchor: typeof Radix.Anchor
export function PopoverContent(props: Radix.PopoverContentProps & { className?: string; align?: "start" | "center" | "end" }): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- Content defaults to `align="center" sideOffset={4}` to match shadcn defaults.

## Acceptance criteria

- SSR renders only the trigger.
- Opening the popover positions content correctly under the trigger, including viewport flip.
- `Esc` and outside-click close it; focus returns to the trigger.
