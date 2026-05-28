import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";

export const island = false as const;

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn(
				"animate-pulse rounded-md bg-accent motion-reduce:animate-none",
				className,
			)}
			{...props}
		/>
	);
}
