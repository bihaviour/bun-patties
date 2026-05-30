import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { Slot } from "./_internal/slot.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";

export const island = false as const;

const itemVariants = cva(
	"group/item flex flex-wrap items-center gap-3 rounded-md border border-transparent text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				muted: "bg-muted/50",
			},
			size: {
				default: "p-4",
				sm: "px-4 py-3",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

type ItemProps = ComponentProps<"div"> &
	VariantProps<typeof itemVariants> & { asChild?: boolean };

export function Item({
	className,
	variant,
	size,
	asChild = false,
	...props
}: ItemProps) {
	const Comp = asChild ? Slot : "div";
	return (
		<Comp
			data-slot="item"
			data-variant={variant ?? "default"}
			data-size={size ?? "default"}
			className={cn(itemVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

const itemMediaVariants = cva(
	"flex shrink-0 items-center justify-center gap-2 [&_svg]:pointer-events-none",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
				image:
					"size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export function ItemMedia({
	className,
	variant,
	...props
}: ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
	return (
		<div
			data-slot="item-media"
			data-variant={variant ?? "default"}
			className={cn(itemMediaVariants({ variant }), className)}
			{...props}
		/>
	);
}

export function ItemContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-content"
			className={cn(
				"flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemTitle({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-title"
			className={cn(
				"flex w-fit items-center gap-2 font-medium text-sm leading-snug",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemDescription({
	className,
	...props
}: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-description"
			className={cn(
				"line-clamp-2 text-balance font-normal text-muted-foreground text-sm leading-normal",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemActions({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-actions"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

export function ItemHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-header"
			className={cn(
				"flex basis-full items-center justify-between gap-2",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-footer"
			className={cn(
				"flex basis-full items-center justify-between gap-2",
				className,
			)}
			{...props}
		/>
	);
}

export function ItemGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-group"
			className={cn("flex w-full flex-col", className)}
			{...props}
		/>
	);
}

export function ItemSeparator({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-separator"
			aria-hidden="true"
			className={cn("my-0 h-px w-full shrink-0 bg-border", className)}
			{...props}
		/>
	);
}
