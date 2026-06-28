---
spec: ui/59-tooltip
title: Tooltip
status: completed
island: true
peer_deps: ["@radix-ui/react-tooltip"]
last_reviewed: 2026-05-23
---

# Tooltip

## Purpose

Hover/focus tooltip. Mirrors shadcn `Tooltip`. Built on `@radix-ui/react-tooltip`.

## Island model

`island: true`. Hover delay, focus events, and portal positioning need JS.

## Peer dependencies

- `@radix-ui/react-tooltip@^1.1`

## Public API

```ts
export const TooltipProvider: typeof Radix.Provider
export const Tooltip: typeof Radix.Root
export const TooltipTrigger: typeof Radix.Trigger
export function TooltipContent(props: Radix.TooltipContentProps & { className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Mount one `TooltipProvider` per root island. `delayDuration` defaults to `200ms`.
- Removes `forwardRef`.
- For purely-decorative tooltips, the spec recommends `title` attribute instead — zero JS.

## Acceptance criteria

- Hover and focus reveal the tooltip after the delay.
- Touch devices suppress hover-only tooltips (Radix default).
- SSR renders only the trigger.
