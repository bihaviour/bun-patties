import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";

export const island = false as const;

const spinnerVariants = cva("animate-spin motion-reduce:animate-none", {
	variants: {
		size: {
			sm: "size-4",
			default: "size-5",
			lg: "size-6",
		},
	},
	defaultVariants: { size: "default" },
});

type SpinnerProps = Omit<ComponentProps<typeof Loader2>, "size"> &
	VariantProps<typeof spinnerVariants>;

export function Spinner({ className, size, ...props }: SpinnerProps) {
	return (
		<Loader2
			role="status"
			aria-label="Loading"
			className={cn(spinnerVariants({ size }), className)}
			{...props}
		/>
	);
}
