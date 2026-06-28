---
spec: ui/24-dropdown-menu
title: Dropdown Menu
status: completed
island: true
peer_deps: ["@radix-ui/react-dropdown-menu", "lucide-react"]
last_reviewed: 2026-05-23
---

# Dropdown Menu

## Purpose

Popover-style menu triggered by a button. Mirrors shadcn `DropdownMenu`. Built on `@radix-ui/react-dropdown-menu`.

## Island model

`island: true`. Open/close, focus management, and roving tab-index require client JS.

## Peer dependencies

- `@radix-ui/react-dropdown-menu@^2.1`
- `lucide-react@^0.400` (Check, ChevronRight, Circle)

## Public API

Mirrors [18-context-menu](./18-context-menu.md) one-to-one, swapping `ContextMenu*` for `DropdownMenu*`. See that spec for the full list.

```ts
export const DropdownMenu: typeof Radix.Root
export const DropdownMenuTrigger: typeof Radix.Trigger
// … (Portal, Group, Sub, RadioGroup, SubTrigger, SubContent, Content, Item,
//     CheckboxItem, RadioItem, Label, Separator, Shortcut)
export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- `Trigger` defaults to `asChild` semantics so a `<Button>` child receives the correct ARIA.

## Acceptance criteria

- SSR renders only the trigger.
- Opening the menu after hydration focuses the first item (or `defaultFocus` target).
- `Esc` closes; outside-click closes; submenus open on hover and `→` key.
- Radio and checkbox items reflect controlled state.
