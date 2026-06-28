---
spec: ui/35-menubar
title: Menubar
status: completed
island: true
peer_deps: ["@radix-ui/react-menubar", "lucide-react"]
last_reviewed: 2026-05-23
---

# Menubar

## Purpose

Application-style top menubar (File / Edit / View …). Mirrors shadcn `Menubar`. Built on `@radix-ui/react-menubar`.

## Island model

`island: true`. Focus traversal between menus and open-state coordination require client JS.

## Peer dependencies

- `@radix-ui/react-menubar@^1.1`
- `lucide-react@^0.400`

## Public API

Same shape as [24-dropdown-menu](./24-dropdown-menu.md) and [18-context-menu](./18-context-menu.md) — `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, `MenubarItem`, `MenubarCheckboxItem`, `MenubarRadioGroup`, `MenubarRadioItem`, `MenubarLabel`, `MenubarSeparator`, `MenubarShortcut`, `MenubarSub`, `MenubarSubTrigger`, `MenubarSubContent`, `MenubarPortal`, `MenubarGroup`.

```ts
export const island = true
```

## Patties adjustments

- The whole menubar is a single island root.
- Removes `forwardRef`.

## Acceptance criteria

- Arrow keys move focus across top-level triggers.
- Opening one menu and hovering another auto-opens the next (Radix default).
- Shortcut text aligns to the right within items.
