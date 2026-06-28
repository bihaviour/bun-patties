---
spec: ui/52-switch
title: Switch
status: completed
island: true
peer_deps: ["@radix-ui/react-switch"]
last_reviewed: 2026-05-23
---

# Switch

## Purpose

On/off toggle. Mirrors shadcn `Switch`. Built on `@radix-ui/react-switch`.

## Island model

`island: true`. Same downgrade story as Checkbox — when used inside a native form with `name`, the build replaces it with a hidden `<input type="checkbox">` styled as a switch (CSS-only) and ships no JS.

## Peer dependencies

- `@radix-ui/react-switch@^1.1`

## Public API

```ts
export function Switch(props: Radix.SwitchProps & { className?: string; nativeForm?: boolean }): JSX.Element
export const island = true
```

## Patties adjustments

- `nativeForm` enables the CSS-only static variant.
- Removes `forwardRef`.

## Acceptance criteria

- Controlled mode toggles via click and `Space`.
- Native mode submits `on` or absent in form data per HTML semantics.
- `aria-checked` reflects state.
