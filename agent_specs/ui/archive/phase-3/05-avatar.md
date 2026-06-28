---
spec: ui/05-avatar
title: Avatar
status: completed
island: true
peer_deps: ["@radix-ui/react-avatar"]
last_reviewed: 2026-05-23
---

# Avatar

## Purpose

User avatar with image + fallback initials. Mirrors shadcn `Avatar`. Built on `@radix-ui/react-avatar`.

## Island model

`island: true`. Fallback visibility flips on image `load`/`error` events; needs client JS to swap.

A static SSR fallback IS rendered first (so users without JS see initials). When the island hydrates, Radix attempts the `<img>` and replaces on success.

## Peer dependencies

- `@radix-ui/react-avatar@^1.1`

## Public API

```ts
export function Avatar(props: Radix.AvatarProps & { className?: string }): JSX.Element
export function AvatarImage(props: Radix.AvatarImageProps & { className?: string }): JSX.Element
export function AvatarFallback(props: Radix.AvatarFallbackProps & { className?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- SSR renders the **fallback first**, not the image, to guarantee no-JS users see something meaningful.
- `delayMs` defaults to `0` since SSR already paints the fallback.
- Removes `forwardRef`.

## Acceptance criteria

- SSR HTML contains the fallback children, not an `<img>`.
- After hydration, `<img>` replaces the fallback if it loads successfully within `delayMs`.
- A broken `src` keeps the fallback visible with `data-state="loading"` → `"error"`.
