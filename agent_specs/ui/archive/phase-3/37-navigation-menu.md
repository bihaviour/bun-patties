---
spec: ui/37-navigation-menu
title: Navigation Menu
status: completed
island: true
peer_deps: ["@radix-ui/react-navigation-menu", "lucide-react"]
last_reviewed: 2026-05-23
---

# Navigation Menu

## Purpose

Top-bar nav with hoverable mega-menu panels. Mirrors shadcn `NavigationMenu`. Built on `@radix-ui/react-navigation-menu`.

## Island model

`island: true`. Open-state coordination and the indicator animation need JS.

## Peer dependencies

- `@radix-ui/react-navigation-menu@^1.2`
- `lucide-react@^0.400`

## Public API

```ts
export function NavigationMenu(props: Radix.NavigationMenuProps & { viewport?: boolean }): JSX.Element
export const NavigationMenuList: typeof Radix.List
export const NavigationMenuItem: typeof Radix.Item
export function NavigationMenuTrigger(props: Radix.NavigationMenuTriggerProps & { className?: string }): JSX.Element
export function NavigationMenuContent(props: Radix.NavigationMenuContentProps & { className?: string }): JSX.Element
export function NavigationMenuLink(props: Radix.NavigationMenuLinkProps): JSX.Element
export function NavigationMenuIndicator(props: Radix.NavigationMenuIndicatorProps & { className?: string }): JSX.Element
export function NavigationMenuViewport(props: Radix.NavigationMenuViewportProps & { className?: string }): JSX.Element

export const navigationMenuTriggerStyle: () => string
export const island = true
```

## Patties adjustments

- Bare links (without a content panel) render as plain `<a>` so navigation works without JS.
- Removes `forwardRef`.

## Acceptance criteria

- Top-level links work as anchors without JS.
- After hydration, hovering a trigger reveals the panel with the indicator animation.
- Mobile fallback: the same component degrades to a stack of links if pointer is coarse.
