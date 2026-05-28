import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { type ButtonSize, buttonVariants } from "./button.tsx";

export const island = false as const;

export type PaginationLinkSize = ButtonSize;

export function Pagination({ className, ...props }: ComponentProps<"nav">) {
	return (
		<nav
			aria-label="pagination"
			data-slot="pagination"
			className={cn("mx-auto flex w-full justify-center", className)}
			{...props}
		/>
	);
}

export function PaginationContent({
	className,
	...props
}: ComponentProps<"ul">) {
	return (
		<ul
			data-slot="pagination-content"
			className={cn("flex flex-row items-center gap-1", className)}
			{...props}
		/>
	);
}

export function PaginationItem(props: ComponentProps<"li">) {
	return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
	isActive?: boolean;
	size?: PaginationLinkSize;
} & ComponentProps<"a">;

export function PaginationLink({
	className,
	isActive = false,
	size = "icon",
	...props
}: PaginationLinkProps) {
	return (
		<a
			data-slot="pagination-link"
			data-active={isActive}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
				className,
			)}
			{...props}
		/>
	);
}

export function PaginationPrevious({
	className,
	children,
	...props
}: ComponentProps<"a">) {
	return (
		<PaginationLink
			aria-label="Go to previous page"
			size="default"
			className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
			{...props}
		>
			<ChevronLeft />
			<span className="hidden sm:block">{children ?? "Previous"}</span>
		</PaginationLink>
	);
}

export function PaginationNext({
	className,
	children,
	...props
}: ComponentProps<"a">) {
	return (
		<PaginationLink
			aria-label="Go to next page"
			size="default"
			className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
			{...props}
		>
			<span className="hidden sm:block">{children ?? "Next"}</span>
			<ChevronRight />
		</PaginationLink>
	);
}

export function PaginationEllipsis({
	className,
	...props
}: ComponentProps<"span">) {
	return (
		<span
			data-slot="pagination-ellipsis"
			aria-hidden="true"
			className={cn("flex size-9 items-center justify-center", className)}
			{...props}
		>
			<MoreHorizontal className="size-4" />
			<span className="sr-only">More pages</span>
		</span>
	);
}
