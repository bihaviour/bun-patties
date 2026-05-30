import { Root as LabelPrimitive } from "@radix-ui/react-label";
import { type ComponentProps, createContext, useContext, useId } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

interface FieldIds {
	id: string;
	descriptionId: string;
	errorId: string;
}

const FieldContext = createContext<FieldIds | null>(null);

function useFieldIds(): FieldIds {
	const ctx = useContext(FieldContext);
	// Fallback ids let the parts work standalone without a Field wrapper.
	const fallback = useId();
	return (
		ctx ?? {
			id: fallback,
			descriptionId: `${fallback}-desc`,
			errorId: `${fallback}-err`,
		}
	);
}

export function Field({
	className,
	orientation = "vertical",
	...props
}: ComponentProps<"div"> & { orientation?: "vertical" | "horizontal" }) {
	const id = useId();
	const ids: FieldIds = {
		id,
		descriptionId: `${id}-desc`,
		errorId: `${id}-err`,
	};
	return (
		<FieldContext.Provider value={ids}>
			{/* biome-ignore lint/a11y/useSemanticElements: a field cluster groups label+control+messages with no single semantic element. */}
			<div
				role="group"
				data-slot="field"
				data-orientation={orientation}
				className={cn(
					"group/field flex w-full gap-2 data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-center data-[orientation=vertical]:flex-col",
					className,
				)}
				{...props}
			/>
		</FieldContext.Provider>
	);
}

export function FieldLabel({
	className,
	htmlFor,
	...props
}: ComponentProps<typeof LabelPrimitive>) {
	const { id } = useFieldIds();
	return (
		<LabelPrimitive
			data-slot="field-label"
			htmlFor={htmlFor ?? id}
			className={cn(
				"flex select-none items-center gap-2 font-medium text-sm leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export function FieldDescription({
	className,
	id,
	...props
}: ComponentProps<"p">) {
	const { descriptionId } = useFieldIds();
	return (
		<p
			data-slot="field-description"
			id={id ?? descriptionId}
			className={cn("text-muted-foreground text-sm leading-normal", className)}
			{...props}
		/>
	);
}

export function FieldError({
	className,
	id,
	errors,
	children,
	...props
}: ComponentProps<"p"> & { errors?: string[] }) {
	const { errorId } = useFieldIds();
	const content =
		children ?? (errors && errors.length > 0 ? errors.join(", ") : null);
	if (content == null) return null;
	return (
		<p
			data-slot="field-error"
			id={id ?? errorId}
			role="alert"
			className={cn("font-medium text-destructive text-sm", className)}
			{...props}
		>
			{content}
		</p>
	);
}

export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="field-group"
			className={cn("flex w-full flex-col gap-6", className)}
			{...props}
		/>
	);
}

export function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
	return (
		<fieldset
			data-slot="field-set"
			className={cn("flex w-full flex-col gap-4", className)}
			{...props}
		/>
	);
}

export function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
	return (
		<legend
			data-slot="field-legend"
			className={cn("mb-1 font-medium text-sm", className)}
			{...props}
		/>
	);
}
