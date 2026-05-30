import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";

export const island = false as const;

export function H1({ className, ...props }: ComponentProps<"h1">) {
	return (
		<h1
			className={cn(
				"scroll-m-20 text-balance font-extrabold text-4xl tracking-tight lg:text-5xl",
				className,
			)}
			{...props}
		/>
	);
}

export function H2({ className, ...props }: ComponentProps<"h2">) {
	return (
		<h2
			className={cn(
				"scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0",
				className,
			)}
			{...props}
		/>
	);
}

export function H3({ className, ...props }: ComponentProps<"h3">) {
	return (
		<h3
			className={cn(
				"scroll-m-20 font-semibold text-2xl tracking-tight",
				className,
			)}
			{...props}
		/>
	);
}

export function H4({ className, ...props }: ComponentProps<"h4">) {
	return (
		<h4
			className={cn(
				"scroll-m-20 font-semibold text-xl tracking-tight",
				className,
			)}
			{...props}
		/>
	);
}

export function P({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
			{...props}
		/>
	);
}

export function Blockquote({
	className,
	...props
}: ComponentProps<"blockquote">) {
	return (
		<blockquote
			className={cn("mt-6 border-l-2 pl-6 italic", className)}
			{...props}
		/>
	);
}

export function InlineCode({ className, ...props }: ComponentProps<"code">) {
	return (
		<code
			className={cn(
				"relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono font-semibold text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export function Lead({ className, ...props }: ComponentProps<"p">) {
	return (
		<p className={cn("text-muted-foreground text-xl", className)} {...props} />
	);
}

export function Large({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("font-semibold text-lg", className)} {...props} />;
}

export function Small({ className, ...props }: ComponentProps<"small">) {
	return (
		<small
			className={cn("font-medium text-sm leading-none", className)}
			{...props}
		/>
	);
}

export function Muted({ className, ...props }: ComponentProps<"p">) {
	return (
		<p className={cn("text-muted-foreground text-sm", className)} {...props} />
	);
}

export function List({ className, ...props }: ComponentProps<"ul">) {
	return (
		<ul
			className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)}
			{...props}
		/>
	);
}
