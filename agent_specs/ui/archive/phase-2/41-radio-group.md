---
spec: ui/41-radio-group
title: Radio Group
status: completed
island: true
peer_deps: ["@radix-ui/react-radio-group", "lucide-react"]
last_reviewed: 2026-05-23
---

# Radio Group

## Purpose

Mutually-exclusive option group. Mirrors shadcn `RadioGroup`. Built on `@radix-ui/react-radio-group`.

## Island model

`island: true` when controlled. With `name` and native form, the build downgrades to native `<input type="radio">` wrappers and ships no JS.

## Peer dependencies

- `@radix-ui/react-radio-group@^1.2`
- `lucide-react@^0.400` (Circle)

## Public API

```ts
export function RadioGroup(props: Radix.RadioGroupProps & { className?: string }): JSX.Element
export function RadioGroupItem(props: Radix.RadioGroupItemProps & { className?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- A `nativeForm` prop forces native-input mode.

## Acceptance criteria

- Native mode: form submission carries the selected radio value with no JS.
- Controlled mode: arrow keys move selection per WAI-ARIA pattern.
- `aria-required` and `aria-invalid` propagate to items.
