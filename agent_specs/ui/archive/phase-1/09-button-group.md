---
spec: ui/09-button-group
title: Button Group
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Button Group

## Purpose

Horizontal cluster of buttons that share borders. Mirrors shadcn `ButtonGroup`.

## Island model

`island: false`. Layout-only wrapper; the contained buttons follow their own island rules.

## Peer dependencies

None.

## Public API

```ts
export function ButtonGroup(props: {
  orientation?: "horizontal" | "vertical"
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>): JSX.Element

export function ButtonGroupSeparator(props: { className?: string }): JSX.Element

export const island = false
```

## Patties adjustments

- Uses `role="group"` on the root with `aria-orientation`.
- Pure flex container — no JS-driven first/last detection. Uses Tailwind `[&>*:first-child]:rounded-l-md` style selectors.

## Acceptance criteria

- Horizontal and vertical orientations produce the correct rounded-corner pattern.
- Nested buttons retain their variant classes; only borders are merged via group selectors.
- Bundle audit: zero JS contributed by this component.
