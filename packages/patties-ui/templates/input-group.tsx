import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";
import { buttonVariants } from "./button.tsx";

export const island = false as const;

export function InputGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: an input + addons cluster has no single semantic HTML element; role="group" is the correct ARIA grouping.
		<div
			role="group"
			data-slot="input-group"
			className={cn(
				"group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs outline-none transition-[color,box-shadow] has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
				className,
			)}
			{...props}
		/>
	);
}

const inputGroupAddonVariants = cva(
	"flex h-auto select-none items-center justify-center gap-2 py-1.5 font-medium text-muted-foreground text-sm [&>svg:not([class*='size-'])]:size-4",
	{
		variants: {
			align: {
				"inline-start": "order-first pl-3 has-[>button]:ml-[-0.45rem]",
				"inline-end": "order-last pr-3 has-[>button]:mr-[-0.45rem]",
				"block-start": "order-first w-full justify-start px-3 pt-3",
				"block-end": "order-last w-full justify-start px-3 pb-3",
			},
		},
		defaultVariants: { align: "inline-start" },
	},
);

export function InputGroupAddon({
	className,
	align,
	...props
}: ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			data-slot="input-group-addon"
			data-align={align ?? "inline-start"}
			className={cn(inputGroupAddonVariants({ align }), className)}
			{...props}
		/>
	);
}

export function InputGroupInput({
	className,
	...props
}: ComponentProps<"input">) {
	return (
		<input
			data-slot="input-group-input"
			className={cn(
				"flex-1 rounded-md bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export function InputGroupText({
	className,
	...props
}: ComponentProps<"span">) {
	return (
		<span
			data-slot="input-group-text"
			className={cn(
				"flex items-center gap-2 text-muted-foreground text-sm [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

// Sizes are input-group-specific; the base/variant layer composes `buttonVariants`.
const inputGroupButtonSizes = cva("shadow-none", {
	variants: {
		size: {
			xs: "h-6 gap-1 px-2 [&>svg:not([class*='size-'])]:size-3.5",
			sm: "h-8 gap-1.5 px-2.5",
			"icon-xs": "size-6 p-0",
			"icon-sm": "size-8 p-0",
		},
	},
	defaultVariants: { size: "xs" },
});

export type InputGroupButtonSize = NonNullable<
	VariantProps<typeof inputGroupButtonSizes>["size"]
>;

export function InputGroupButton({
	className,
	size,
	type = "button",
	...props
}: ComponentProps<"button"> & VariantProps<typeof inputGroupButtonSizes>) {
	return (
		<button
			type={type}
			data-slot="input-group-button"
			className={cn(
				buttonVariants({ variant: "ghost" }),
				inputGroupButtonSizes({ size }),
				className,
			)}
			{...props}
		/>
	);
}
