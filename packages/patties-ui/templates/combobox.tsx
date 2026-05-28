import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "./_internal/cn.ts";
import { Button } from "./button.tsx";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "./command.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";

export const island = true as const;

// Composed example (Popover + Command), not a tightly-wrapped primitive. The
// whole thing is one island root, so the shared open/filter state never crosses
// the SSR boundary. `options` must be JSON-serializable (strings only).
export function Combobox({
	options,
	value,
	onChange,
	placeholder = "Select option...",
	emptyMessage = "No results found.",
	className,
}: {
	options: Array<{ value: string; label: string }>;
	value?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	emptyMessage?: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [internal, setInternal] = useState(value ?? "");
	const selected = value ?? internal;
	const selectedLabel = options.find((o) => o.value === selected)?.label;

	function select(next: string) {
		const resolved = next === selected ? "" : next;
		if (value === undefined) setInternal(resolved);
		onChange?.(resolved);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn("w-[200px] justify-between", className)}
				>
					{selectedLabel ?? placeholder}
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0">
				<Command>
					<CommandInput placeholder={placeholder} />
					<CommandList>
						<CommandEmpty>{emptyMessage}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem
									key={option.value}
									value={option.value}
									onSelect={select}
								>
									<Check
										className={cn(
											"mr-2 size-4",
											selected === option.value ? "opacity-100" : "opacity-0",
										)}
									/>
									{option.label}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
