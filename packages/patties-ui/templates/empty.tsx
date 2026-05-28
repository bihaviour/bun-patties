import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";

export const island = false as const;

export function Empty({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
				className,
			)}
			{...props}
		/>
	);
}

export function EmptyHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn(
				"flex max-w-sm flex-col items-center gap-2 text-center",
				className,
			)}
			{...props}
		/>
	);
}

const emptyMediaVariants = cva(
	"mb-2 flex shrink-0 items-center justify-center",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "flex size-10 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-6",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export function EmptyMedia({
	className,
	variant,
	...props
}: ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			data-slot="empty-media"
			data-variant={variant ?? "default"}
			className={cn(emptyMediaVariants({ variant }), className)}
			{...props}
		/>
	);
}

export function EmptyTitle({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-title"
			className={cn("font-medium text-lg tracking-tight", className)}
			{...props}
		/>
	);
}

export function EmptyDescription({
	className,
	...props
}: ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-description"
			className={cn(
				"text-muted-foreground text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

export function EmptyContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cn(
				"flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
				className,
			)}
			{...props}
		/>
	);
}
