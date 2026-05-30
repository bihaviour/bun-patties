import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";

export const island = false as const;

const buttonGroupVariants = cva(
	"flex w-fit items-stretch [&>*]:focus-within:z-10 [&>*]:focus:z-10",
	{
		variants: {
			orientation: {
				horizontal:
					"[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
				vertical:
					"flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
			},
		},
		defaultVariants: { orientation: "horizontal" },
	},
);

export function ButtonGroup({
	className,
	orientation,
	...props
}: ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
	const resolved = orientation === "vertical" ? "vertical" : "horizontal";
	return (
		// biome-ignore lint/a11y/useSemanticElements: a button cluster has no single semantic HTML element; role="group" is the correct ARIA grouping.
		<div
			role="group"
			data-slot="button-group"
			data-orientation={resolved}
			className={cn(buttonGroupVariants({ orientation: resolved }), className)}
			{...props}
		/>
	);
}

export function ButtonGroupSeparator({
	className,
	...props
}: ComponentProps<"div">) {
	return (
		<div
			data-slot="button-group-separator"
			aria-hidden="true"
			className={cn("self-stretch bg-input", className)}
			{...props}
		/>
	);
}
