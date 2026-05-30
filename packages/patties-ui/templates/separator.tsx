import { Root } from "@radix-ui/react-separator";
import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";

export const island = false as const;

export function Separator({
	className,
	orientation = "horizontal",
	decorative = true,
	...props
}: ComponentProps<typeof Root>) {
	return (
		<Root
			data-slot="separator"
			decorative={decorative}
			orientation={orientation}
			className={cn(
				"shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
				className,
			)}
			{...props}
		/>
	);
}
