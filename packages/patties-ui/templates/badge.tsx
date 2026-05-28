import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";
import { Slot } from "./_internal/slot.ts";
import { cva, type VariantProps } from "./_internal/variants.ts";

export const island = false as const;

const badgeVariants = cva(
	"inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary text-primary-foreground",
				secondary: "border-transparent bg-secondary text-secondary-foreground",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground",
				outline: "text-foreground",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

type BadgeProps = ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean };

export function Badge({
	className,
	variant,
	asChild = false,
	...props
}: BadgeProps) {
	const Comp = asChild ? Slot : "span";
	return (
		<Comp
			data-slot="badge"
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}
