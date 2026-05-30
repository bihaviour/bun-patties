import useEmblaCarousel, {
	type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
	type ComponentProps,
	createContext,
	type KeyboardEvent,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { cn } from "./_internal/cn.ts";
import { Button } from "./button.tsx";

export const island = true as const;

type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];
export type CarouselApi = UseEmblaCarouselType[1];

type CarouselProps = {
	opts?: CarouselOptions;
	plugins?: CarouselPlugin;
	orientation?: "horizontal" | "vertical";
	setApi?: (api: CarouselApi) => void;
};

type CarouselContextValue = {
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
	api: CarouselApi;
	orientation: "horizontal" | "vertical";
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
	mounted: boolean;
};

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel(): CarouselContextValue {
	const ctx = useContext(CarouselContext);
	if (!ctx) throw new Error("useCarousel must be used within a <Carousel />");
	return ctx;
}

export function Carousel({
	orientation = "horizontal",
	opts,
	setApi,
	plugins,
	className,
	children,
	...props
}: ComponentProps<"div"> & CarouselProps) {
	const [carouselRef, api] = useEmblaCarousel(
		{ ...opts, axis: orientation === "horizontal" ? "x" : "y" },
		plugins,
	);
	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);
	const [mounted, setMounted] = useState(false);

	const onSelect = useCallback((a: CarouselApi) => {
		if (!a) return;
		setCanScrollPrev(a.canScrollPrev());
		setCanScrollNext(a.canScrollNext());
	}, []);

	const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
	const scrollNext = useCallback(() => api?.scrollNext(), [api]);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				scrollPrev();
			} else if (event.key === "ArrowRight") {
				event.preventDefault();
				scrollNext();
			}
		},
		[scrollPrev, scrollNext],
	);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (api && setApi) setApi(api);
	}, [api, setApi]);

	useEffect(() => {
		if (!api) return;
		onSelect(api);
		api.on("reInit", onSelect);
		api.on("select", onSelect);
		return () => {
			api.off("select", onSelect);
		};
	}, [api, onSelect]);

	return (
		<CarouselContext.Provider
			value={{
				carouselRef,
				api,
				orientation,
				scrollPrev,
				scrollNext,
				canScrollPrev,
				canScrollNext,
				mounted,
			}}
		>
			{/* biome-ignore lint/a11y/useSemanticElements: the W3C carousel pattern marks the root with role="region" + aria-roledescription="carousel". */}
			<div
				className={cn("relative", className)}
				role="region"
				aria-roledescription="carousel"
				onKeyDownCapture={onKeyDown}
				{...props}
			>
				{children}
			</div>
		</CarouselContext.Provider>
	);
}

export function CarouselContent({
	className,
	...props
}: ComponentProps<"div">) {
	const { carouselRef, orientation, mounted } = useCarousel();
	return (
		<div
			ref={carouselRef}
			// Pre-hydration the items live in a native scroll-snap track so they stay
			// visible with zero JS; once mounted, Embla owns an overflow-hidden viewport.
			className={
				mounted ? "overflow-hidden" : "snap-x snap-mandatory overflow-x-auto"
			}
		>
			<div
				className={cn(
					"flex",
					orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

export function CarouselItem({ className, ...props }: ComponentProps<"div">) {
	const { orientation } = useCarousel();
	return (
		// biome-ignore lint/a11y/useSemanticElements: the W3C carousel pattern marks each slide with role="group" + aria-roledescription="slide".
		<div
			role="group"
			aria-roledescription="slide"
			className={cn(
				"min-w-0 shrink-0 grow-0 basis-full snap-start",
				orientation === "horizontal" ? "pl-4" : "pt-4",
				className,
			)}
			{...props}
		/>
	);
}

export function CarouselPrevious({
	className,
	variant = "outline",
	size = "icon",
	...props
}: ComponentProps<typeof Button>) {
	const { orientation, scrollPrev, canScrollPrev } = useCarousel();
	return (
		<Button
			variant={variant}
			size={size}
			className={cn(
				"absolute size-8 rounded-full",
				orientation === "horizontal"
					? "-left-12 -translate-y-1/2 top-1/2"
					: "-top-12 -translate-x-1/2 left-1/2 rotate-90",
				className,
			)}
			disabled={!canScrollPrev}
			onClick={scrollPrev}
			{...props}
		>
			<ArrowLeft className="size-4" />
			<span className="sr-only">Previous slide</span>
		</Button>
	);
}

export function CarouselNext({
	className,
	variant = "outline",
	size = "icon",
	...props
}: ComponentProps<typeof Button>) {
	const { orientation, scrollNext, canScrollNext } = useCarousel();
	return (
		<Button
			variant={variant}
			size={size}
			className={cn(
				"absolute size-8 rounded-full",
				orientation === "horizontal"
					? "-right-12 -translate-y-1/2 top-1/2"
					: "-bottom-12 -translate-x-1/2 left-1/2 rotate-90",
				className,
			)}
			disabled={!canScrollNext}
			onClick={scrollNext}
			{...props}
		>
			<ArrowRight className="size-4" />
			<span className="sr-only">Next slide</span>
		</Button>
	);
}
