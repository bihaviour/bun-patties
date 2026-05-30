import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";

export const island = false as const;

export function AspectRatio({
	ratio = 1,
	className,
	style,
	...props
}: { ratio?: number } & ComponentProps<"div">) {
	const safe = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
	return (
		<div
			data-slot="aspect-ratio"
			className={cn("w-full", className)}
			style={{ position: "relative", aspectRatio: String(safe), ...style }}
			{...props}
		/>
	);
}
