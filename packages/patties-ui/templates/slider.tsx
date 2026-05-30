import { Range, Root, Thumb, Track } from "@radix-ui/react-slider";
import { type ComponentProps, useMemo } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

type SliderProps = ComponentProps<typeof Root>;

export function Slider({
	className,
	min = 0,
	max = 100,
	value,
	defaultValue,
	name,
	...props
}: SliderProps) {
	const values = useMemo(
		() =>
			Array.isArray(value)
				? value
				: Array.isArray(defaultValue)
					? defaultValue
					: [min, max],
		[value, defaultValue, min, max],
	);
	const thumbs = value ?? defaultValue ?? [min];
	const thumbCount = Array.isArray(thumbs) ? thumbs.length : 1;

	return (
		<Root
			data-slot="slider"
			min={min}
			max={max}
			value={value}
			defaultValue={defaultValue}
			className={cn(
				"relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[disabled]:opacity-50",
				className,
			)}
			{...props}
		>
			<Track
				data-slot="slider-track"
				className="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
			>
				<Range
					data-slot="slider-range"
					className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
				/>
			</Track>
			{Array.from({ length: thumbCount }, (_, i) => (
				<Thumb
					// biome-ignore lint/suspicious/noArrayIndexKey: thumb count is positional and stable for a given slider.
					key={i}
					data-slot="slider-thumb"
					className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50"
				/>
			))}
			{name
				? values.map((v, i) => (
						<input
							// biome-ignore lint/suspicious/noArrayIndexKey: hidden inputs are positional, one per thumb.
							key={i}
							type="range"
							name={name}
							min={min}
							max={max}
							defaultValue={v}
							readOnly
							hidden
							className="sr-only"
						/>
					))
				: null}
		</Root>
	);
}
