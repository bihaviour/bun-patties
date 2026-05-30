import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";
import { type ComponentProps, useContext } from "react";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

export function InputOTP({
	className,
	containerClassName,
	...props
}: ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
	return (
		<OTPInput
			data-slot="input-otp"
			containerClassName={cn(
				"flex items-center gap-2 has-disabled:opacity-50",
				containerClassName,
			)}
			className={cn("disabled:cursor-not-allowed", className)}
			{...props}
		/>
	);
}

export function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="input-otp-group"
			className={cn("flex items-center", className)}
			{...props}
		/>
	);
}

export function InputOTPSlot({
	index,
	className,
	...props
}: ComponentProps<"div"> & { index: number }) {
	const inputOTPContext = useContext(OTPInputContext);
	const slot = inputOTPContext?.slots[index];
	const char = slot?.char;
	const hasFakeCaret = slot?.hasFakeCaret;
	const isActive = slot?.isActive;
	return (
		<div
			data-slot="input-otp-slot"
			data-active={isActive}
			className={cn(
				"relative flex h-9 w-9 items-center justify-center border-input border-y border-r text-sm shadow-xs outline-none transition-all first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		>
			{char}
			{hasFakeCaret ? (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-4 w-px animate-caret-blink bg-foreground duration-1000 motion-reduce:animate-none" />
				</div>
			) : null}
		</div>
	);
}

export function InputOTPSeparator(props: ComponentProps<"div">) {
	return (
		<div data-slot="input-otp-separator" aria-hidden="true" {...props}>
			<MinusIcon />
		</div>
	);
}
