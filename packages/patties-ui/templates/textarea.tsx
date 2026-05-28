import {
	type ComponentProps,
	useCallback,
	useLayoutEffect,
	useRef,
} from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

const baseClass = cn(
	"flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
	"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
	"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
);

type TextareaProps = ComponentProps<"textarea"> & {
	autoResize?: boolean;
	maxRows?: number;
};

export function Textarea({
	className,
	autoResize = false,
	maxRows,
	...props
}: TextareaProps) {
	if (!autoResize) {
		return (
			<textarea
				data-slot="textarea"
				className={cn(baseClass, className)}
				{...props}
			/>
		);
	}
	return (
		<AutoResizeTextarea className={className} maxRows={maxRows} {...props} />
	);
}

function AutoResizeTextarea({
	className,
	maxRows,
	onInput,
	...props
}: Omit<TextareaProps, "autoResize">) {
	const ref = useRef<HTMLTextAreaElement>(null);

	const resize = useCallback(
		(el: HTMLTextAreaElement): void => {
			el.style.height = "auto";
			const style = getComputedStyle(el);
			const lineHeight = Number.parseFloat(style.lineHeight) || 0;
			const padding =
				Number.parseFloat(style.paddingTop) +
				Number.parseFloat(style.paddingBottom);
			const max =
				maxRows && lineHeight
					? lineHeight * maxRows + padding
					: Number.POSITIVE_INFINITY;
			const next = Math.min(el.scrollHeight, max);
			el.style.height = `${next}px`;
			el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
		},
		[maxRows],
	);

	useLayoutEffect(() => {
		if (ref.current) resize(ref.current);
	}, [resize]);

	return (
		<textarea
			ref={ref}
			data-slot="textarea"
			className={cn(baseClass, "resize-none", className)}
			onInput={(e) => {
				resize(e.currentTarget);
				onInput?.(e);
			}}
			{...props}
		/>
	);
}
