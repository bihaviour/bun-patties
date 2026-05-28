import * as Dialog from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

export function Command({
	className,
	...props
}: ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(
				"flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
				className,
			)}
			{...props}
		/>
	);
}

// CommandDialog deliberately wraps the palette in the raw `@radix-ui/react-dialog`
// primitive rather than the catalog's Dialog component, so Command stays buildable
// independently of the phase-3 Dialog.
export function CommandDialog({
	title = "Command Palette",
	description = "Search for a command to run...",
	open,
	onOpenChange,
	children,
}: {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children?: ReactNode;
	title?: string;
	description?: string;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<Dialog.Content className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg gap-4 overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg">
					<Dialog.Title className="sr-only">{title}</Dialog.Title>
					<Dialog.Description className="sr-only">
						{description}
					</Dialog.Description>
					<Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5">
						{children}
					</Command>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function CommandInput({
	className,
	...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="flex h-9 items-center gap-2 border-b px-3"
		>
			<SearchIcon className="size-4 shrink-0 opacity-50" />
			<CommandPrimitive.Input
				className={cn(
					"flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

export function CommandList({
	className,
	...props
}: ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			className={cn(
				"max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden",
				className,
			)}
			{...props}
		/>
	);
}

export function CommandEmpty(
	props: ComponentProps<typeof CommandPrimitive.Empty>,
) {
	return (
		<CommandPrimitive.Empty className="py-6 text-center text-sm" {...props} />
	);
}

export function CommandGroup({
	className,
	...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			className={cn(
				"overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs",
				className,
			)}
			{...props}
		/>
	);
}

export function CommandItem({
	className,
	...props
}: ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);
}

export function CommandShortcut({
	className,
	...props
}: ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"ml-auto text-muted-foreground text-xs tracking-widest",
				className,
			)}
			{...props}
		/>
	);
}

export function CommandSeparator({
	className,
	...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			className={cn("-mx-1 h-px bg-border", className)}
			{...props}
		/>
	);
}
