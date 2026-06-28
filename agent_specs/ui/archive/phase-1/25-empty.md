---
spec: ui/25-empty
title: Empty
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Empty

## Purpose

Empty-state placeholder. Mirrors shadcn `Empty`.

## Island model

`island: false`. Pure presentational.

## Peer dependencies

None.

## Public API

```ts
export function Empty(props: React.ComponentProps<"div">): JSX.Element
export function EmptyHeader(props: React.ComponentProps<"div">): JSX.Element
export function EmptyMedia(props: { variant?: "default" | "icon"; className?: string; children?: React.ReactNode }): JSX.Element
export function EmptyTitle(props: React.ComponentProps<"div">): JSX.Element
export function EmptyDescription(props: React.ComponentProps<"div">): JSX.Element
export function EmptyContent(props: React.ComponentProps<"div">): JSX.Element

export const island = false
```

## Patties adjustments

None beyond drop of `forwardRef`.

## Acceptance criteria

- All sub-slots render with expected token classes.
- Bundle audit: zero JS.
