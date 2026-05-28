import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { type ComponentProps, createContext, useContext } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

interface NativeForm {
	native: boolean;
	name?: string;
	required?: boolean;
}
const NativeFormContext = createContext<NativeForm>({ native: false });

type RadioGroupProps = ComponentProps<typeof Root> & {
	// Patties-specific: render native <input type="radio"> items for no-JS forms.
	nativeForm?: boolean;
};

export function RadioGroup({
	className,
	nativeForm = false,
	...props
}: RadioGroupProps) {
	if (nativeForm) {
		const { name, defaultValue, required, dir, children } =
			props as ComponentProps<"div"> & {
				name?: string;
				defaultValue?: string;
				required?: boolean;
			};
		return (
			<NativeFormContext.Provider value={{ native: true, name, required }}>
				<div
					role="radiogroup"
					data-slot="radio-group"
					data-native-default={defaultValue}
					dir={dir}
					className={cn("grid gap-3", className)}
				>
					{children}
				</div>
			</NativeFormContext.Provider>
		);
	}
	return (
		<Root
			data-slot="radio-group"
			className={cn("grid gap-3", className)}
			{...props}
		/>
	);
}

type RadioGroupItemProps = ComponentProps<typeof Item> & {
	name?: string;
};

const itemClass = cn(
	"aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
	"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
	"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
);

export function RadioGroupItem({
	className,
	value,
	name,
	...props
}: RadioGroupItemProps) {
	const group = useContext(NativeFormContext);
	if (group.native) {
		const { disabled, required } = props as ComponentProps<"input">;
		return (
			<input
				type="radio"
				data-slot="radio-group-item"
				name={name ?? group.name}
				value={value as string}
				disabled={disabled}
				required={required ?? group.required}
				className={cn(
					itemClass,
					"appearance-none checked:border-primary",
					"checked:bg-[length:0.5rem] checked:bg-center checked:bg-no-repeat checked:bg-[image:url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%208%208'%3E%3Ccircle%20cx='4'%20cy='4'%20r='4'%20fill='%23171717'/%3E%3C/svg%3E\")]",
					className,
				)}
			/>
		);
	}
	return (
		<Item
			data-slot="radio-group-item"
			value={value}
			className={cn(itemClass, className)}
			{...props}
		>
			<Indicator
				data-slot="radio-group-indicator"
				className="relative flex items-center justify-center"
			>
				<Circle className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
			</Indicator>
		</Item>
	);
}
