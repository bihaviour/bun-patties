---
spec: ui/49-slider
title: Slider
status: completed
island: true
peer_deps: ["@radix-ui/react-slider"]
last_reviewed: 2026-05-23
---

# Slider

## Purpose

Range slider with one or more thumbs. Mirrors shadcn `Slider`. Built on `@radix-ui/react-slider`.

## Island model

`island: true`. Drag and keyboard interaction need client JS.

## Peer dependencies

- `@radix-ui/react-slider@^1.2`

## Public API

```ts
export function Slider(props: Radix.SliderProps & { className?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- Renders a hidden `<input type="range" name>` per thumb when `name` is set, so native form submission works.

## Acceptance criteria

- Arrow keys move the thumb by `step`.
- Multi-thumb mode renders two thumbs and prevents crossing.
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow` are correct.
- RTL flips the axis direction.
