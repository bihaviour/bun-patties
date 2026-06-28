---
spec: ui/58-toggle-group
title: Toggle Group
status: completed
island: true
peer_deps: ["@radix-ui/react-toggle-group"]
last_reviewed: 2026-05-23
---

# Toggle Group

## Purpose

A group of toggles in single- or multi-select mode. Mirrors shadcn `ToggleGroup`. Built on `@radix-ui/react-toggle-group`.

## Island model

`island: true`. Selection state and roving tab-index need JS.

## Peer dependencies

- `@radix-ui/react-toggle-group@^1.1`

## Public API

```ts
export function ToggleGroup(props: Radix.ToggleGroupSingleProps | Radix.ToggleGroupMultipleProps & { variant?: ToggleVariant; size?: ToggleSize; className?: string }): JSX.Element
export function ToggleGroupItem(props: Radix.ToggleGroupItemProps & { variant?: ToggleVariant; size?: ToggleSize; className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- Children inherit `variant`/`size` via React Context — items can override.

## Acceptance criteria

- Single mode: only one item pressed at a time.
- Multi mode: independent toggles.
- Arrow keys move focus between items per WAI-ARIA pattern.
