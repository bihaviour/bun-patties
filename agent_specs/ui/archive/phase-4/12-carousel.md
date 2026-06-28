---
spec: ui/12-carousel
title: Carousel
status: draft
island: true
peer_deps: ["embla-carousel-react", "lucide-react"]
last_reviewed: 2026-05-23
---

# Carousel

## Purpose

Swipeable item track with prev/next controls. Mirrors shadcn `Carousel`. Built on `embla-carousel-react`.

## Island model

`island: true`. Embla measures the DOM and tracks pointer/wheel events; must hydrate.

## Peer dependencies

- `embla-carousel-react@^8`
- `lucide-react@^0.400`

## Public API

```ts
export type CarouselApi = UseEmblaCarouselType[1]

export function Carousel(props: {
  opts?: Parameters<typeof useEmblaCarousel>[0]
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
  plugins?: Parameters<typeof useEmblaCarousel>[1]
  className?: string
  children?: React.ReactNode
}): JSX.Element

export function CarouselContent(props: React.ComponentProps<"div">): JSX.Element
export function CarouselItem(props: React.ComponentProps<"div">): JSX.Element
export function CarouselPrevious(props: ButtonProps): JSX.Element
export function CarouselNext(props: ButtonProps): JSX.Element

export const island = true
```

## Patties adjustments

- The carousel root is the island. `setApi` runs only in the browser; documented and warned in dev.
- SSR fallback: items render as a static horizontal scroll-snap container so they remain visible pre-hydration.
- Removes `forwardRef`.

## Acceptance criteria

- Static SSR snapshot shows items in a `overflow-x-auto snap-x` fallback container.
- After hydration, Embla takes over and pointer/wheel paging works.
- Prev/Next buttons disable at the ends (Embla `canScrollPrev`/`canScrollNext`).
- `prefers-reduced-motion` disables auto-play plugins.
