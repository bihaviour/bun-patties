import { format as formatDate, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { cn } from "./_internal/cn.ts";
import { Button } from "./button.tsx";
import { Calendar } from "./calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";

export const island = true as const;

// Dates only ever cross the island boundary as ISO strings; Date objects are
// parsed in-island. A hidden input carries the ISO value for server forms.
function toDate(iso?: string): Date | undefined {
	return iso ? parseISO(iso) : undefined;
}
function toIso(date?: Date): string | undefined {
	return date ? formatDate(date, "yyyy-MM-dd") : undefined;
}

export function DatePicker({
	value,
	defaultValue,
	onChange,
	placeholder = "Pick a date",
	format = "PPP",
	disabled,
	name,
	className,
}: {
	value?: string;
	defaultValue?: string;
	onChange?: (iso: string | undefined) => void;
	placeholder?: string;
	format?: string;
	disabled?: boolean;
	name?: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [internal, setInternal] = useState(defaultValue);
	const iso = value ?? internal;
	const date = toDate(iso);

	function select(next: Date | undefined) {
		const nextIso = toIso(next);
		if (value === undefined) setInternal(nextIso);
		onChange?.(nextIso);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					className={cn(
						"w-[240px] justify-start text-left font-normal",
						!date && "text-muted-foreground",
						className,
					)}
				>
					<CalendarIcon className="mr-2 size-4" />
					{date ? formatDate(date, format) : <span>{placeholder}</span>}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={date}
					onSelect={select}
					defaultMonth={iso}
				/>
			</PopoverContent>
			{name ? <input type="hidden" name={name} value={iso ?? ""} /> : null}
		</Popover>
	);
}

export function DateRangePicker({
	value,
	defaultValue,
	onChange,
	className,
}: {
	value?: { from?: string; to?: string };
	defaultValue?: { from?: string; to?: string };
	onChange?: (range: { from?: string; to?: string }) => void;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [internal, setInternal] = useState(defaultValue);
	const range = value ?? internal;
	const selected: DateRange | undefined = range?.from
		? { from: toDate(range.from), to: toDate(range.to) }
		: undefined;

	function select(next: DateRange | undefined) {
		const nextRange = { from: toIso(next?.from), to: toIso(next?.to) };
		if (value === undefined) setInternal(nextRange);
		onChange?.(nextRange);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						"w-[300px] justify-start text-left font-normal",
						!range?.from && "text-muted-foreground",
						className,
					)}
				>
					<CalendarIcon className="mr-2 size-4" />
					{range?.from ? (
						range.to ? (
							`${formatDate(parseISO(range.from), "LLL dd, y")} - ${formatDate(parseISO(range.to), "LLL dd, y")}`
						) : (
							formatDate(parseISO(range.from), "LLL dd, y")
						)
					) : (
						<span>Pick a date range</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="range"
					selected={selected}
					onSelect={select}
					defaultMonth={range?.from}
					numberOfMonths={2}
				/>
			</PopoverContent>
		</Popover>
	);
}
