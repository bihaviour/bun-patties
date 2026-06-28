---
spec: ui/40-progress
title: Progress
status: completed
island: true
peer_deps: ["@radix-ui/react-progress"]
last_reviewed: 2026-05-23
---

# Progress

## Purpose

Linear progress bar. Mirrors shadcn `Progress`. Built on `@radix-ui/react-progress`.

## Island model

`island: true` when the `value` is meant to update dynamically. For static `value` (e.g. a step in a server-rendered checkout), the build downgrades to a plain `<div role="progressbar">` with no JS.

## Peer dependencies

- `@radix-ui/react-progress@^1.1`

## Public API

```ts
export function Progress(props: Radix.ProgressProps & { className?: string; indicatorClassName?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- A static-progress variant is exported as a class helper for non-island use.

## Acceptance criteria

- Renders `role="progressbar"` with `aria-valuenow`, `aria-valuemax`.
- Indicator translates correctly across all values 0–100.
- Indeterminate state animates a stripe (CSS-only).
