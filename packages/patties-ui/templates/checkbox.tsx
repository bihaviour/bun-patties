import { Indicator, Root } from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

type CheckboxProps = ComponentProps<typeof Root> & {
	// Patties-specific: render a native <input type="checkbox"> for no-JS forms.
	nativeForm?: boolean;
};

const boxClass = cn(
	"size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow disabled:cursor-not-allowed disabled:opacity-50",
	"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
	"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
	"data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
);

export function Checkbox({ className, nativeForm, ...props }: CheckboxProps) {
	if (nativeForm) {
		const { name, value, defaultChecked, checked, disabled, required } =
			props as ComponentProps<"input">;
		return (
			<input
				type="checkbox"
				data-slot="checkbox"
				name={name}
				value={value}
				defaultChecked={defaultChecked as boolean | undefined}
				checked={checked as boolean | undefined}
				disabled={disabled}
				required={required}
				className={cn(
					"size-4 shrink-0 appearance-none rounded-[4px] border border-input shadow-xs outline-none transition-shadow disabled:cursor-not-allowed disabled:opacity-50",
					"checked:border-primary checked:bg-primary",
					"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
					"checked:bg-[length:0.75rem] checked:bg-center checked:bg-no-repeat checked:bg-[image:url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='white'%20stroke-width='3'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M20%206%209%2017l-5-5'/%3E%3C/svg%3E\")]",
					className,
				)}
			/>
		);
	}
	return (
		<Root
			data-slot="checkbox"
			className={cn("group peer", boxClass, className)}
			{...props}
		>
			<Indicator
				data-slot="checkbox-indicator"
				className="flex items-center justify-center text-current"
			>
				<Check className="hidden size-3.5 group-data-[state=checked]:block" />
				<Minus className="hidden size-3.5 group-data-[state=indeterminate]:block" />
			</Indicator>
		</Root>
	);
}
