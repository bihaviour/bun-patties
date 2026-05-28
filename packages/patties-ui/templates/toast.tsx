import * as ToastPrimitives from "@radix-ui/react-toast";
import { XIcon } from "lucide-react";
import {
	type ComponentProps,
	type ReactElement,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { cn } from "./_internal/cn.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";

export const island = true as const;

export const ToastProvider = ToastPrimitives.Provider;

export function ToastViewport({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Viewport>) {
	return (
		<ToastPrimitives.Viewport
			className={cn(
				"fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:right-0 sm:bottom-0 sm:flex-col md:max-w-[420px]",
				className,
			)}
			{...props}
		/>
	);
}

const toastVariants = cva(
	"group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[state=closed]:animate-out data-[state=open]:animate-in data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full data-[state=closed]:slide-out-to-right-full data-[swipe=end]:slide-out-to-right-full data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[swipe=cancel]:translate-x-0",
	{
		variants: {
			variant: {
				default: "border bg-background text-foreground",
				destructive:
					"destructive group border-destructive bg-destructive text-destructive-foreground",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export function Toast({
	className,
	variant,
	...props
}: ComponentProps<typeof ToastPrimitives.Root> &
	VariantProps<typeof toastVariants>) {
	return (
		<ToastPrimitives.Root
			className={cn(toastVariants({ variant }), className)}
			{...props}
		/>
	);
}

export function ToastAction({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Action>) {
	return (
		<ToastPrimitives.Action
			className={cn(
				"inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 font-medium text-sm outline-none transition-colors hover:bg-secondary focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export function ToastClose({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Close>) {
	return (
		<ToastPrimitives.Close
			className={cn(
				"absolute top-1 right-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
				className,
			)}
			toast-close=""
			{...props}
		>
			<XIcon className="size-4" />
		</ToastPrimitives.Close>
	);
}

export function ToastTitle({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Title>) {
	return (
		<ToastPrimitives.Title
			className={cn("font-semibold text-sm", className)}
			{...props}
		/>
	);
}

export function ToastDescription({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Description>) {
	return (
		<ToastPrimitives.Description
			className={cn("text-sm opacity-90", className)}
			{...props}
		/>
	);
}

type ToastActionElement = ReactElement<typeof ToastAction>;

interface ToasterToast {
	id: string;
	title?: ReactNode;
	description?: ReactNode;
	action?: ToastActionElement;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	variant?: VariantProps<typeof toastVariants>["variant"];
}

type ToastOptions = Omit<ToasterToast, "id">;

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1_000_000;

let counter = 0;
function genId(): string {
	counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
	return counter.toString();
}

const listeners: Array<(state: ToasterToast[]) => void> = [];
let memoryState: ToasterToast[] = [];
const removeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function dispatch(next: ToasterToast[]): void {
	memoryState = next;
	for (const listener of listeners) listener(memoryState);
}

function scheduleRemove(id: string): void {
	if (removeTimeouts.has(id)) return;
	const timeout = setTimeout(() => {
		removeTimeouts.delete(id);
		dispatch(memoryState.filter((t) => t.id !== id));
	}, TOAST_REMOVE_DELAY);
	removeTimeouts.set(id, timeout);
}

export function toast(opts: ToastOptions): {
	id: string;
	dismiss: () => void;
	update: (next: ToastOptions) => void;
} {
	const id = genId();
	const dismiss = () => {
		dispatch(memoryState.map((t) => (t.id === id ? { ...t, open: false } : t)));
		scheduleRemove(id);
	};
	const update = (next: ToastOptions) => {
		dispatch(memoryState.map((t) => (t.id === id ? { ...t, ...next } : t)));
	};
	const entry: ToasterToast = {
		...opts,
		id,
		open: true,
		onOpenChange: (open) => {
			if (!open) dismiss();
		},
	};
	dispatch([entry, ...memoryState].slice(0, TOAST_LIMIT));
	return { id, dismiss, update };
}

export function useToast(): {
	toasts: ToasterToast[];
	toast: typeof toast;
	dismiss: (id?: string) => void;
} {
	const [state, setState] = useState<ToasterToast[]>(memoryState);
	useEffect(() => {
		listeners.push(setState);
		return () => {
			const index = listeners.indexOf(setState);
			if (index > -1) listeners.splice(index, 1);
		};
	}, []);
	return {
		toasts: state,
		toast,
		dismiss: (id?: string) => {
			dispatch(
				memoryState.map((t) =>
					id === undefined || t.id === id ? { ...t, open: false } : t,
				),
			);
			if (id) scheduleRemove(id);
			else for (const t of memoryState) scheduleRemove(t.id);
		},
	};
}
