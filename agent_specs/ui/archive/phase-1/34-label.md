---
spec: ui/34-label
title: Label
status: completed
island: false
peer_deps: ["@radix-ui/react-label"]
last_reviewed: 2026-05-23
---

# Label

## Purpose

Form label that pairs with `htmlFor`. Mirrors shadcn `Label`. Built on `@radix-ui/react-label`.

## Island model

`island: false`. Radix Label is pure presentational on the server — the only "JS" feature (preventing text selection on double-click of associated control) is a tiny `onPointerDown` handler. We accept the minor JS cost as part of the parent island when applicable; standalone Labels still render zero JS.

## Peer dependencies

- `@radix-ui/react-label@^2.1`

## Public API

```ts
export function Label(props: React.ComponentProps<typeof LabelPrimitive.Root>): JSX.Element
export const island = false
```

## Patties adjustments

- Removes `forwardRef`.

## Acceptance criteria

- `htmlFor` correctly associates label with control.
- Clicking the label focuses the control (native browser behavior — no JS needed).
- Bundle audit: zero JS when used standalone (Radix Label compiles away if its event handler is unused).
