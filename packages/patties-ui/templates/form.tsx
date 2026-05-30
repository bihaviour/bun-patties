import { Root as LabelPrimitive } from "@radix-ui/react-label";
import { type ComponentProps, createContext, useContext, useId } from "react";
import {
	Controller,
	type ControllerProps,
	type FieldError,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
	useFormState,
} from "react-hook-form";
import { cn } from "./_internal/cn.ts";
import { Slot } from "./_internal/slot.ts";

export const island = true as const;

export const Form = FormProvider;

interface FormFieldContextValue {
	name: string;
}
const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function FormField<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
	return (
		<FormFieldContext.Provider value={{ name: props.name }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	);
}

interface FormItemContextValue {
	id: string;
}
const FormItemContext = createContext<FormItemContextValue | null>(null);

export function useFormField(): {
	id: string;
	name: string;
	formItemId: string;
	formDescriptionId: string;
	formMessageId: string;
	error?: FieldError;
} {
	const fieldContext = useContext(FormFieldContext);
	const itemContext = useContext(FormItemContext);
	const { getFieldState } = useFormContext();
	const formState = useFormState({ name: fieldContext?.name });
	if (!fieldContext) {
		throw new Error("useFormField must be used within <FormField>");
	}
	if (!itemContext) {
		throw new Error("useFormField must be used within <FormItem>");
	}
	const fieldState = getFieldState(fieldContext.name, formState);
	const { id } = itemContext;
	return {
		id,
		name: fieldContext.name,
		formItemId: `${id}-form-item`,
		formDescriptionId: `${id}-form-item-description`,
		formMessageId: `${id}-form-item-message`,
		error: fieldState.error,
	};
}

export function FormItem({ className, ...props }: ComponentProps<"div">) {
	const id = useId();
	return (
		<FormItemContext.Provider value={{ id }}>
			<div
				data-slot="form-item"
				className={cn("grid gap-2", className)}
				{...props}
			/>
		</FormItemContext.Provider>
	);
}

export function FormLabel({
	className,
	...props
}: ComponentProps<typeof LabelPrimitive>) {
	const { error, formItemId } = useFormField();
	return (
		<LabelPrimitive
			data-slot="form-label"
			data-error={!!error}
			htmlFor={formItemId}
			className={cn(
				"flex select-none items-center gap-2 font-medium text-sm leading-none data-[error=true]:text-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export function FormControl(props: ComponentProps<typeof Slot>) {
	const { error, formItemId, formDescriptionId, formMessageId } =
		useFormField();
	return (
		<Slot
			data-slot="form-control"
			id={formItemId}
			aria-describedby={
				error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
			}
			aria-invalid={!!error}
			{...props}
		/>
	);
}

export function FormDescription({ className, ...props }: ComponentProps<"p">) {
	const { formDescriptionId } = useFormField();
	return (
		<p
			data-slot="form-description"
			id={formDescriptionId}
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export function FormMessage({
	className,
	children,
	...props
}: ComponentProps<"p">) {
	const { error, formMessageId } = useFormField();
	const body = error ? String(error?.message ?? "") : children;
	if (!body) return null;
	return (
		<p
			data-slot="form-message"
			id={formMessageId}
			className={cn("font-medium text-destructive text-sm", className)}
			{...props}
		>
			{body}
		</p>
	);
}
