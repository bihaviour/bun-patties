---
spec: ui/57-toggle
title: Toggle
status: completed
island: true
peer_deps: ["@radix-ui/react-toggle", "class-variance-authority"]
last_reviewed: 2026-05-23
---

# Toggle

## Purpose

Two-state button (pressed / unpressed). Mirrors shadcn `Toggle`. Built on `@radix-ui/react-toggle`.

## Island model

`island: true` when controlled. Uncontrolled (`defaultPressed`) usage with no state observation can render as a static `<button aria-pressed>` with no JS — the build decides.

## Peer dependencies

- `@radix-ui/react-toggle@^1.1`
- `class-variance-authority@^0.7`

## Public API

```ts
export type ToggleVariant = "default" | "outline"
export type ToggleSize = "default" | "sm" | "lg"

export function Toggle(props: Radix.ToggleProps & { variant?: ToggleVariant; size?: ToggleSize; className?: string }): JSX.Element
export const toggleVariants: (opts: { variant?: ToggleVariant; size?: ToggleSize }) => string
export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- `toggleVariants` exported for use by [58-toggle-group](./58-toggle-group.md).

## Acceptance criteria

- Clicking flips `data-state` and `aria-pressed`.
- Keyboard `Space` and `Enter` toggle.
- Variants and sizes snapshot correctly.
