import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "./_internal/cn.ts";
import { buttonVariants } from "./button.tsx";

export const island = true as const;

// `defaultMonth` crosses the island boundary as an ISO string (Dates are not
// JSON-serializable island props) and is parsed back to a Date in-component.
export type CalendarProps = Omit<
	ComponentProps<typeof DayPicker>,
	"defaultMonth"
> & {
	defaultMonth?: string;
};

export function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	defaultMonth,
	...props
}: CalendarProps) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			defaultMonth={defaultMonth ? new Date(defaultMonth) : undefined}
			className={cn("p-3", className)}
			classNames={{
				months: "relative flex flex-col gap-4 sm:flex-row",
				month: "flex w-full flex-col gap-4",
				month_caption:
					"relative flex h-9 w-full items-center justify-center px-9",
				caption_label: "select-none font-medium text-sm",
				nav: "absolute inset-x-0 top-0 flex items-center justify-between",
				button_previous: cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"size-9 select-none p-0 opacity-50 hover:opacity-100",
				),
				button_next: cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"size-9 select-none p-0 opacity-50 hover:opacity-100",
				),
				month_grid: "w-full border-collapse",
				weekdays: "flex",
				weekday:
					"w-9 flex-1 select-none rounded-md font-normal text-[0.8rem] text-muted-foreground",
				week: "mt-2 flex w-full",
				day: "relative size-9 flex-1 select-none p-0 text-center text-sm focus-within:relative focus-within:z-20",
				day_button: cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"size-9 select-none font-normal aria-selected:opacity-100",
				),
				range_start: "rounded-l-md bg-accent",
				range_middle: "rounded-none bg-accent aria-selected:text-foreground",
				range_end: "rounded-r-md bg-accent",
				selected:
					"rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
				today: "rounded-md bg-accent text-accent-foreground",
				outside: "text-muted-foreground opacity-50",
				disabled: "text-muted-foreground opacity-50",
				hidden: "invisible",
				...classNames,
			}}
			components={{
				Chevron: ({ orientation, className: chevronClass }) => {
					const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
					return <Icon className={cn("size-4", chevronClass)} />;
				},
			}}
			{...props}
		/>
	);
}
