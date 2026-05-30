import {
	type ComponentProps,
	type ComponentType,
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useId,
	useState,
} from "react";
import * as Recharts from "recharts";
import { cn } from "./_internal/cn.ts";

export const island = true as const;

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = Record<
	string,
	{
		label?: ReactNode;
		// Referenced by registered key, never passed across the island boundary.
		icon?: ComponentType;
		color?: string;
		theme?: Record<keyof typeof THEMES, string>;
	}
>;

type ChartContextProps = { config: ChartConfig };
const ChartContext = createContext<ChartContextProps | null>(null);

function useChart(): ChartContextProps {
	const ctx = useContext(ChartContext);
	if (!ctx)
		throw new Error("useChart must be used within a <ChartContainer />");
	return ctx;
}

export function ChartContainer({
	id,
	className,
	children,
	config,
	...props
}: ComponentProps<"div"> & {
	config: ChartConfig;
	children: ComponentProps<typeof Recharts.ResponsiveContainer>["children"];
}) {
	const uniqueId = useId();
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
	// Recharts measures the container with a ResizeObserver, so it can only run in
	// the browser. SSR (and the first client render) emit a sized placeholder at
	// the configured aspect ratio; the chart fills in after hydration with no shift.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				data-chart={chartId}
				className={cn(
					"flex aspect-video justify-center overflow-hidden text-xs [&_.recharts-cartesian-grid_line]:stroke-border/50",
					className,
				)}
				{...props}
			>
				<ChartStyle id={chartId} config={config} />
				{mounted ? (
					<Recharts.ResponsiveContainer>
						{children}
					</Recharts.ResponsiveContainer>
				) : null}
			</div>
		</ChartContext.Provider>
	);
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
	const colorConfig = Object.entries(config).filter(
		([, c]) => c.theme || c.color,
	);
	if (!colorConfig.length) return null;

	const css = Object.entries(THEMES)
		.map(
			([theme, prefix]) => `${prefix} [data-chart=${id}] {
${colorConfig
	.map(([key, itemConfig]) => {
		const color =
			itemConfig.theme?.[theme as keyof typeof THEMES] ?? itemConfig.color;
		return color ? `  --color-${key}: ${color};` : null;
	})
	.filter(Boolean)
	.join("\n")}
}`,
		)
		.join("\n");

	// biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is derived from the JSON-serializable chart config, never user HTML.
	return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export const ChartTooltip = Recharts.Tooltip;
export const ChartLegend = Recharts.Legend;

export function ChartTooltipContent({
	active,
	payload,
	label,
	className,
	hideLabel = false,
	hideIndicator = false,
	indicator = "dot",
	nameKey,
}: ComponentProps<typeof Recharts.Tooltip> &
	ComponentProps<"div"> & {
		hideLabel?: boolean;
		hideIndicator?: boolean;
		indicator?: "line" | "dot" | "dashed";
		nameKey?: string;
	}) {
	const { config } = useChart();
	if (!active || !payload?.length) return null;

	return (
		<div
			className={cn(
				"grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
				className,
			)}
		>
			{hideLabel ? null : <div className="font-medium">{label}</div>}
			<div className="grid gap-1.5">
				{payload.map((item, index) => {
					const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
					const itemConfig = config[key];
					const fallbackColor =
						item.color ?? (item.payload as { fill?: string })?.fill;
					return (
						<div
							key={`${item.dataKey ?? index}`}
							className="flex w-full items-center gap-2"
						>
							{hideIndicator ? null : (
								<span
									className={cn(
										"shrink-0 rounded-[2px] bg-[var(--color-bg)]",
										indicator === "dot" ? "size-2.5" : "w-1",
									)}
									style={{
										backgroundColor: `var(--color-${key}, ${fallbackColor})`,
									}}
								/>
							)}
							<span className="text-muted-foreground">
								{itemConfig?.label ?? item.name}
							</span>
							<span className="ml-auto font-medium text-foreground tabular-nums">
								{item.value}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function ChartLegendContent({
	className,
	payload,
	hideIcon = false,
	nameKey,
	verticalAlign = "bottom",
}: ComponentProps<"div"> &
	Pick<ComponentProps<typeof Recharts.Legend>, "payload" | "verticalAlign"> & {
		hideIcon?: boolean;
		nameKey?: string;
	}) {
	const { config } = useChart();
	if (!payload?.length) return null;

	return (
		<div
			className={cn(
				"flex items-center justify-center gap-4",
				verticalAlign === "top" ? "pb-3" : "pt-3",
				className,
			)}
		>
			{payload.map((item) => {
				const key = `${nameKey ?? item.dataKey ?? "value"}`;
				const itemConfig = config[key];
				return (
					<div key={`${item.value}`} className="flex items-center gap-1.5">
						{hideIcon ? null : (
							<span
								className="size-2 shrink-0 rounded-[2px]"
								style={{ backgroundColor: item.color }}
							/>
						)}
						{itemConfig?.label ?? item.value}
					</div>
				);
			})}
		</div>
	);
}
