---
spec: ui/29-input
title: Input
status: completed
island: true
peer_deps: []
last_reviewed: 2026-05-23
---

# Input

## Purpose

Styled `<input>`. Mirrors shadcn `Input`.

## Island model

`island: true` if it has `onChange`/`onBlur` JS handlers. As an uncontrolled native input inside a server form, it is effectively island-free — the build downgrades it when no handlers are bound.

## Peer dependencies

None.

## Public API

```ts
export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- Drops `forwardRef`.
- No special wrapper — it's literally `<input class={...} {...props} />`.

## Acceptance criteria

- Native form submission carries the input value when no JS is present.
- All `type` values (text, email, number, file, etc.) render with consistent styling.
- `disabled` and `aria-invalid` produce the documented styles.
