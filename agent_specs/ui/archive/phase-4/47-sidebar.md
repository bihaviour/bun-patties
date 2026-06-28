---
spec: ui/47-sidebar
title: Sidebar
status: draft
island: true
peer_deps: ["@radix-ui/react-slot", "@radix-ui/react-tooltip", "lucide-react"]
last_reviewed: 2026-05-23
---

# Sidebar

## Purpose

App-shell sidebar with collapsible/icon mode, mobile sheet fallback, and persistence. Mirrors shadcn `Sidebar` (the multi-piece recipe).

## Island model

`island: true`. State (`expanded` / `collapsed`), persistence (`cookie` or `localStorage`), mobile media query, and the `SidebarTrigger` button all need JS.

## Peer dependencies

- `@radix-ui/react-slot@^1.1`
- `@radix-ui/react-tooltip@^1.1` (for collapsed icon tooltips)
- `lucide-react@^0.400`

## Public API

The full set of exports from shadcn's sidebar primitive: `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `SidebarInput`, `SidebarHeader`, `SidebarFooter`, `SidebarSeparator`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`, plus the `useSidebar` hook.

```ts
export const island = true
```

## Patties adjustments

- The sidebar's collapsed/expanded state is stored in a cookie (`patties_sidebar_state=…`) so the server can render the correct initial state with **no flash** on hydration. The CLI stamps a tiny Patties middleware example that reads this cookie.
- Removes `forwardRef`.
- Replaces shadcn's `next/link`/`react-router` couplings with plain `<a>`; users can override via `asChild`.

## Acceptance criteria

- Server renders the correct collapsed/expanded shell based on the cookie — no flash.
- `SidebarTrigger` toggles state and writes the cookie.
- On mobile (`< md`), the sidebar collapses into a Sheet.
- `Cmd/Ctrl+B` hotkey toggles the sidebar (configurable via prop).
