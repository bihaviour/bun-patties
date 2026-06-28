---
spec: ui/10-calendar
title: Calendar
status: draft
island: true
peer_deps: ["react-day-picker", "date-fns", "lucide-react"]
last_reviewed: 2026-05-23
---

# Calendar

## Purpose

Month-grid date picker primitive. Mirrors shadcn `Calendar`. Built on `react-day-picker`.

## Island model

`island: true`. Selection state and month navigation are client-only.

## Peer dependencies

- `react-day-picker@^9`
- `date-fns@^4`
- `lucide-react@^0.400`

## Public API

```ts
export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  className?: string
  classNames?: Partial<Record<keyof typeof DayPicker.defaultProps.classNames, string>>
  showOutsideDays?: boolean
}

export function Calendar(props: CalendarProps): JSX.Element
export const island = true
```

## Patties adjustments

- Default `weekStartsOn` reads from the `Direction` provider (see [22-direction](./22-direction.md)) and locale defaults.
- `Date` is forbidden as an island prop. Pass `defaultMonth` as an ISO string and the component parses it in-island.
- Removes `forwardRef`.

## Acceptance criteria

- SSR renders the initial month grid with correct day labels for the page locale.
- Clicking a day fires `onSelect` (in-island) and updates the visual selection.
- Keyboard `←/→/↑/↓/PageUp/PageDown` navigate days/months per `react-day-picker` defaults.
- Bundle does not pull in the full `date-fns` index — only the locale and the few format functions actually used.
