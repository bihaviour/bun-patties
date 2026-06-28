---
spec: ui/36-native-select
title: Native Select
status: completed
island: true
peer_deps: []
last_reviewed: 2026-05-23
---

# Native Select

## Purpose

Styled native `<select>` element — accessible and tiny. Mirrors shadcn `NativeSelect`.

## Island model

`island: true` when controlled with `onChange`. As an uncontrolled `<select name="...">` inside a server form, it works with zero JS — the build downgrades it.

## Peer dependencies

None.

## Public API

```ts
export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- This is the recommended select for server forms; [44-select](./44-select.md) is for richer client-only UX.

## Acceptance criteria

- Native form submission carries the selected value with no JS.
- Renders a chevron icon on the trailing edge via background-image (no extra DOM).
- Disabled state styles match the design system.
