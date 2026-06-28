---
spec: ui/20-date-picker
title: Date Picker
status: draft
island: true
peer_deps: ["react-day-picker", "date-fns", "@radix-ui/react-popover", "lucide-react"]
last_reviewed: 2026-05-23
---

# Date Picker

## Purpose

Input + Popover + Calendar composed pattern. Mirrors shadcn `Date Picker`.

## Island model

`island: true`. Selection, popover state, parsing input text — all client.

## Peer dependencies

- `react-day-picker@^9`
- `date-fns@^4`
- `@radix-ui/react-popover@^1.1`
- `lucide-react@^0.400`

## Public API

```ts
export function DatePicker(props: {
  value?: string                  // ISO date string
  defaultValue?: string
  onChange?: (iso: string | undefined) => void
  placeholder?: string
  format?: string                 // date-fns format string
  disabled?: boolean
  className?: string
}): JSX.Element

export function DateRangePicker(props: {
  value?: { from?: string; to?: string }
  defaultValue?: { from?: string; to?: string }
  onChange?: (range: { from?: string; to?: string }) => void
  className?: string
}): JSX.Element

export const island = true
```

## Patties adjustments

- All dates cross the island boundary as ISO strings. `Date` objects are parsed in-island only.
- A hidden `<input type="hidden">` carries the ISO value so the picker works inside server forms.
- Removes `forwardRef`.

## Acceptance criteria

- SSR renders the formatted current value in the trigger.
- Picking a date updates the trigger label and the hidden input.
- Range picker constrains `to >= from`.
- Submitting a form posts the ISO string under the supplied `name`.
