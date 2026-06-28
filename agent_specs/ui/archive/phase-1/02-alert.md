---
spec: ui/02-alert
title: Alert
status: completed
island: false
peer_deps: ["class-variance-authority"]
last_reviewed: 2026-05-23
---

# Alert

## Purpose

A static callout — info / warning / destructive. Mirrors shadcn `Alert`. No interactivity, no dismiss button by default.

## Island model

`island: false`. Pure presentational; ships zero client JS.

## Peer dependencies

- `class-variance-authority@^0.7`

## Public API

```ts
export type AlertVariant = "default" | "destructive"

export function Alert(props: {
  variant?: AlertVariant
  className?: string
  children?: React.ReactNode
}): JSX.Element

export function AlertTitle(props: { className?: string; children?: React.ReactNode }): JSX.Element
export function AlertDescription(props: { className?: string; children?: React.ReactNode }): JSX.Element

export const island = false
```

## Patties adjustments

- Drops `forwardRef`.
- Uses `role="alert"` on the root.
- A `dismissible` variant exists upstream; in Patties it is provided by [03-alert-dialog](./03-alert-dialog.md) instead, since "dismissible" implies state.

## Acceptance criteria

- Renders `role="alert"` with correct ARIA semantics under SSR.
- `variant="destructive"` applies destructive tokens (`--destructive`, `--destructive-foreground`).
- Bundle audit: page using only `Alert` ships zero JS.
