---
spec: ui/44-select
title: Select
status: completed
island: true
peer_deps: ["@radix-ui/react-select", "lucide-react"]
last_reviewed: 2026-05-23
---

# Select

## Purpose

Custom-rendered single-select. Mirrors shadcn `Select`. Built on `@radix-ui/react-select`.

## Island model

`island: true`. Custom listbox, virtual positioning, and keyboard navigation require client JS.

For server forms with no JS, use [36-native-select](./36-native-select.md) instead.

## Peer dependencies

- `@radix-ui/react-select@^2.1`
- `lucide-react@^0.400` (Check, ChevronDown, ChevronUp)

## Public API

```ts
export const Select: typeof Radix.Root
export const SelectGroup: typeof Radix.Group
export const SelectValue: typeof Radix.Value
export function SelectTrigger(props: Radix.SelectTriggerProps & { className?: string }): JSX.Element
export function SelectScrollUpButton(props: Radix.SelectScrollUpButtonProps & { className?: string }): JSX.Element
export function SelectScrollDownButton(props: Radix.SelectScrollDownButtonProps & { className?: string }): JSX.Element
export function SelectContent(props: Radix.SelectContentProps & { className?: string }): JSX.Element
export function SelectLabel(props: Radix.SelectLabelProps & { className?: string }): JSX.Element
export function SelectItem(props: Radix.SelectItemProps & { className?: string }): JSX.Element
export function SelectSeparator(props: Radix.SelectSeparatorProps & { className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- A hidden `<select name="...">` is rendered by Radix when `name` is set, so the value posts in native form submissions.

## Acceptance criteria

- SSR renders only the trigger with the current label.
- Opening the listbox positions it under the trigger and traps focus.
- Type-ahead jumps to matching items.
- Form submit posts the selected value.
