---
spec: ui/01-accordion
title: Accordion
status: completed
island: true
peer_deps: ["@radix-ui/react-accordion", "lucide-react"]
last_reviewed: 2026-05-23
---

# Accordion

## Purpose

Vertically stacked, expandable sections — mirrors shadcn `Accordion`. Built on `@radix-ui/react-accordion`.

## Island model

`island: true`. Open-state is client state; ARIA `aria-expanded` flips on user interaction; chevron rotates via Radix `data-state`.

The root `<Accordion>` IS the island; nested `AccordionItem`s share that island's React root and do not register independently.

## Peer dependencies

- `@radix-ui/react-accordion@^1.2`
- `lucide-react@^0.400` (ChevronDown icon)

## Public API

```ts
export const Accordion: typeof AccordionPrimitive.Root
export function AccordionItem(props: AccordionPrimitive.AccordionItemProps & { className?: string }): JSX.Element
export function AccordionTrigger(props: AccordionPrimitive.AccordionTriggerProps & { className?: string }): JSX.Element
export function AccordionContent(props: AccordionPrimitive.AccordionContentProps & { className?: string }): JSX.Element
export const island = true
```

## Patties adjustments

- No `forwardRef`. Refs are accepted via the `ref` prop (React 19).
- `onValueChange` is allowed because the entire tree is in one island — props do not cross the SSR boundary.
- Default `type="single"` and `collapsible` if neither is specified, to match the most common shadcn snippet.

## Acceptance criteria

- SSR output renders all items collapsed (uncontrolled default) and matches snapshot.
- Clicking a trigger toggles `data-state="open"` and reveals content after hydration.
- Keyboard `↑/↓/Home/End/Space/Enter` all work per WAI-ARIA pattern.
- `prefers-reduced-motion` disables the height-collapse transition.
