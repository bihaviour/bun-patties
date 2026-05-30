import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

// Trailing chevron is drawn with a background-image data URI so the control
// stays a single <select> with no extra DOM.
const chevron =
	"bg-[length:1rem] bg-[position:right_0.5rem_center] bg-no-repeat bg-[image:url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23737373'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='m6%209%206%206%206-6'/%3E%3C/svg%3E\")]";

export function NativeSelect({
	className,
	...props
}: ComponentProps<"select">) {
	return (
		<select
			data-slot="native-select"
			className={cn(
				"flex h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-3 text-base shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				chevron,
				className,
			)}
			{...props}
		/>
	);
}
