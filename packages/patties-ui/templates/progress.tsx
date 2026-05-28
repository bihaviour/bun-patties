import { Indicator, Root } from "@radix-ui/react-progress";
import type { ComponentProps, CSSProperties } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

type ProgressProps = ComponentProps<typeof Root> & {
	indicatorClassName?: string;
};

const trackClass =
	"relative h-2 w-full overflow-hidden rounded-full bg-primary/20";
const indicatorBase = "h-full w-full flex-1 bg-primary transition-all";

export function Progress({
	className,
	indicatorClassName,
	value,
	...props
}: ProgressProps) {
	return (
		<Root
			data-slot="progress"
			value={value}
			className={cn(trackClass, className)}
			{...props}
		>
			<Indicator
				data-slot="progress-indicator"
				className={cn(indicatorBase, indicatorClassName)}
				style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
			/>
		</Root>
	);
}

// Static (non-island) progress bar for server-rendered, fixed values: zero JS.
export function progressStyle(value: number): {
	className: string;
	indicatorClassName: string;
	indicatorStyle: CSSProperties;
} {
	return {
		className: trackClass,
		indicatorClassName: indicatorBase,
		indicatorStyle: { transform: `translateX(-${100 - value}%)` },
	};
}
