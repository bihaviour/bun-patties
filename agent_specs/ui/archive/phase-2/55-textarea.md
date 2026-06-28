---
spec: ui/55-textarea
title: Textarea
status: completed
island: true
peer_deps: []
last_reviewed: 2026-05-23
---

# Textarea

## Purpose

Styled `<textarea>`. Mirrors shadcn `Textarea`.

## Island model

`island: true` if controlled. Native uncontrolled mode (server form) ships no JS.

## Peer dependencies

None.

## Public API

```ts
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- No auto-resize by default; an opt-in `autoResize` prop installs a tiny ResizeObserver-based island.

## Acceptance criteria

- Native form submission works without JS.
- `disabled` and `aria-invalid` styles applied.
- `autoResize` grows the textarea to fit content; respects `maxRows`.
