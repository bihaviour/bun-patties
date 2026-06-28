---
spec: ui/14-checkbox
title: Checkbox
status: completed
island: true
peer_deps: ["@radix-ui/react-checkbox", "lucide-react"]
last_reviewed: 2026-05-23
---

# Checkbox

## Purpose

Tri-state checkbox. Mirrors shadcn `Checkbox`. Built on `@radix-ui/react-checkbox`.

## Island model

`island: true` when controlled. When uncontrolled with a `name` for native form submission, it can downgrade to a hidden `<input type="checkbox">` and render as `island: false` — exposed via the `nativeForm` prop.

## Peer dependencies

- `@radix-ui/react-checkbox@^1.1`
- `lucide-react@^0.400` (Check, Minus icons)

## Public API

```ts
export function Checkbox(props: Radix.CheckboxProps & {
  className?: string
  nativeForm?: boolean   // Patties-specific: render as native <input> for no-JS forms
}): JSX.Element

export const island = true
```

## Patties adjustments

- `nativeForm` toggle lets server forms work without JS.
- Removes `forwardRef`.
- Indeterminate state uses `checked="indeterminate"` (Radix convention).

## Acceptance criteria

- Native form submission with `nativeForm` works without hydration.
- Controlled mode: clicking flips checked state and dispatches `onCheckedChange` in-island.
- Indeterminate state renders the `Minus` icon.
- Keyboard: `Space` toggles; `Tab` moves focus.
