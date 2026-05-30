import { cn } from "./_internal/cn.ts";

export const island = false as const;

export interface HelloProps {
	name?: string;
	className?: string;
}

export function Hello({ name = "world", className }: HelloProps) {
	return (
		<p className={cn("patties-hello", className)} data-testid="hello">
			Hello, {name}!
		</p>
	);
}
