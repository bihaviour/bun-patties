---
spec: ui/08-button
title: Button
status: completed
island: subtree
peer_deps: ["class-variance-authority"]
last_reviewed: 2026-05-23
---

# Button

## Purpose

The canonical button. Mirrors shadcn `Button`. The single most-used component — its island story matters.

## Island model

`island: "subtree"`. Two delivery modes:

1. **Server button** — when used as a link-like or form-submit (`type="submit"`), no `onClick`. Server-rendered, zero JS.
2. **Island button** — when wrapped in an island parent (Dialog, Form, etc.) OR when the page mounts an island that depends on a click handler. The component itself does not auto-island; instead it inherits its parent island root.

Pages that use Buttons only as link/submit ship zero JS for them.

## Peer dependencies

- `class-variance-authority@^0.7`

## Public API

```ts
export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
export type ButtonSize = "default" | "sm" | "lg" | "icon"

export function Button(props: {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element

export const buttonVariants: (opts: { variant?: ButtonVariant; size?: ButtonSize }) => string
export const island = "subtree"
```

## Patties adjustments

- `buttonVariants` is exported so other components (e.g. `AlertDialogAction`) can compose classes without depending on `Button`.
- `asChild` uses `_internal/slot.tsx`.
- Drops `forwardRef`.

## Phase-1 inline-styling debt to resolve here

Phase 1 shipped before this spec existed, so two phase-1 components inlined their own minimal button `cva` rather than depend on a not-yet-built Button:

- [Pagination](../../archive/phase-1/38-pagination.md) — `PaginationLink` inlines a local `cva` and a local `PaginationLinkSize` union instead of importing `buttonVariants` / `ButtonSize`.
- [Input Group](../../archive/phase-1/30-input-group.md) — `InputGroupButton` inlines `inputGroupButtonVariants` instead of composing `buttonVariants`.

Both templates carry a `// Phase 1 inlines button styling…` comment marking the spot. When implementing Button, migrate these to import `buttonVariants` (and `ButtonSize`) so there is a single source of truth for button styling. This is the reason `buttonVariants` is exported as a standalone.

## Acceptance criteria

- All variant × size combinations snapshot correctly.
- `asChild` with an `<a>` child renders an anchor with the button classes and forwards focus styles.
- A button with `type="submit"` inside a `<form action="/x" method="post">` works without any client JS.
- A button with `onClick` inside an island parent hydrates and the handler fires.
- Pagination's `PaginationLink` and Input Group's `InputGroupButton` are refactored to compose `buttonVariants` instead of their inlined local `cva`, with their phase-1 `// Phase 1 inlines button styling` comments removed.
