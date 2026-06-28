---
spec: ui/50-sonner
title: Sonner
status: completed
island: true
peer_deps: ["sonner"]
last_reviewed: 2026-05-24
---

# Sonner

## Purpose

Toast notifications via `sonner`. Mirrors shadcn `Sonner`. Recommended over [56-toast](./56-toast.md).

## Island model

`island: true`. Toaster mounts a portal and listens for imperative `toast(...)` calls. Lives at the root of the page layout.

## Peer dependencies

- `sonner@^1.5`

> Upstream shadcn pairs Sonner with `next-themes`; Patties does not. Theme is read from the `class="dark"` attribute on `<html>` via a tiny DOM observer.

## Public API

```ts
export function Toaster(props: React.ComponentProps<typeof Sonner> & { theme?: "light" | "dark" | "system" }): JSX.Element
export { toast } from "sonner"

export const island = true
```

## Patties adjustments

- `theme` is read from a small DOM observer on `<html class="dark">`, not `next-themes`.
- Mount `<Toaster />` in a root island; only one per app.

## Acceptance criteria

- `toast("hi")` from any island renders a toast.
- Theme follows the document's dark mode class.
- Pre-hydration: no toaster DOM is rendered (lazy mount).
