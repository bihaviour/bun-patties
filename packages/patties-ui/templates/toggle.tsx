import { Root } from "@radix-ui/react-toggle";
import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";

export const island = true as const;

export const toggleVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-[color,box-shadow] hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline:
					"border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
			},
			size: {
				default: "h-9 min-w-9 px-2",
				sm: "h-8 min-w-8 px-1.5",
				lg: "h-10 min-w-10 px-2.5",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

export type ToggleVariant = NonNullable<
	VariantProps<typeof toggleVariants>["variant"]
>;
export type ToggleSize = NonNullable<
	VariantProps<typeof toggleVariants>["size"]
>;

type ToggleProps = ComponentProps<typeof Root> &
	VariantProps<typeof toggleVariants>;

export function Toggle({ className, variant, size, ...props }: ToggleProps) {
	return (
		<Root
			data-slot="toggle"
			className={cn(toggleVariants({ variant, size }), className)}
			{...props}
		/>
	);
}
