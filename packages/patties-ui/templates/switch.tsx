import { Root, Thumb } from "@radix-ui/react-switch";
import type { ComponentProps } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

type SwitchProps = ComponentProps<typeof Root> & {
	// Patties-specific: render a CSS-only native <input type="checkbox"> for no-JS forms.
	nativeForm?: boolean;
};

const trackClass = cn(
	"peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
	"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

export function Switch({ className, nativeForm, ...props }: SwitchProps) {
	if (nativeForm) {
		const { name, value, defaultChecked, checked, disabled, required } =
			props as ComponentProps<"input">;
		return (
			<input
				type="checkbox"
				data-slot="switch"
				name={name}
				value={value}
				defaultChecked={defaultChecked as boolean | undefined}
				checked={checked as boolean | undefined}
				disabled={disabled}
				required={required}
				className={cn(
					trackClass,
					"relative appearance-none bg-input",
					"checked:bg-primary",
					"before:pointer-events-none before:absolute before:left-0.5 before:size-4 before:rounded-full before:bg-background before:transition-transform before:content-[''] checked:before:translate-x-[calc(100%-2px)]",
					className,
				)}
			/>
		);
	}
	return (
		<Root
			data-slot="switch"
			className={cn(
				trackClass,
				"data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
				className,
			)}
			{...props}
		>
			<Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
			/>
		</Root>
	);
}
