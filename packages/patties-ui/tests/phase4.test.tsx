import { describe, expect, test } from "bun:test";
import * as Recharts from "recharts";
import { Calendar } from "../templates/calendar.tsx";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "../templates/carousel.tsx";
import { ChartContainer } from "../templates/chart.tsx";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "../templates/command.tsx";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "../templates/resizable.tsx";
import { hydrate } from "./helpers/hydrate.ts";
import { renderStatic } from "./helpers/render-static.ts";

// Running react-dom/server then react-dom/client in one process makes React warn
// about "multiple renderers" for any shared context. It's a test-harness artifact,
// not a hydration-mismatch defect, so we ignore it when asserting.
const BENIGN = ["Detected multiple renderers concurrently"];
function hydrationErrors(errors: string[]): string[] {
	return errors.filter((e) => !BENIGN.some((b) => e.includes(b)));
}

describe("Calendar", () => {
	test("SSR renders the month grid for the given ISO defaultMonth", async () => {
		const html = await renderStatic(<Calendar defaultMonth="2026-01-15" />);
		expect(html).toContain("January 2026");
		expect(html).toContain("<table");
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(<Calendar defaultMonth="2026-01-15" />);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Carousel", () => {
	function Demo() {
		return (
			<Carousel>
				<CarouselContent>
					<CarouselItem>One</CarouselItem>
					<CarouselItem>Two</CarouselItem>
				</CarouselContent>
				<CarouselPrevious />
				<CarouselNext />
			</Carousel>
		);
	}

	test("SSR fallback is a native scroll-snap track so items show pre-hydration", async () => {
		const html = await renderStatic(<Demo />);
		expect(html).toContain('aria-roledescription="carousel"');
		expect(html).toContain("overflow-x-auto");
		expect(html).toContain("snap-x");
		expect(html).toContain("One");
		expect(html).toContain("Two");
	});

	test("after hydration Embla takes over an overflow-hidden viewport", async () => {
		const { errors, hydratedHtml } = await hydrate(<Demo />);
		expect(hydrationErrors(errors)).toEqual([]);
		expect(hydratedHtml).toContain("overflow-hidden");
	});
});

describe("Chart", () => {
	function Demo() {
		return (
			<ChartContainer config={{ v: { label: "Visitors", color: "#2563eb" } }}>
				<Recharts.BarChart data={[{ name: "a", v: 10 }]}>
					<Recharts.Bar dataKey="v" fill="var(--color-v)" />
				</Recharts.BarChart>
			</ChartContainer>
		);
	}

	test("SSR renders a sized placeholder and no recharts output", async () => {
		const html = await renderStatic(<Demo />);
		expect(html).toContain('data-chart="chart-');
		expect(html).toContain("aspect-video");
		// Recharts only mounts in the browser — its wrapper must not appear in SSR.
		expect(html).not.toContain("recharts-wrapper");
	});

	test("ChartStyle emits the tokenized --color-* CSS variable", async () => {
		const html = await renderStatic(<Demo />);
		expect(html).toContain("--color-v: #2563eb");
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(<Demo />);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Command", () => {
	function Demo() {
		return (
			<Command>
				<CommandInput placeholder="Type a command..." />
				<CommandList>
					<CommandEmpty>No results.</CommandEmpty>
					<CommandGroup heading="Suggestions">
						<CommandItem value="calendar">Calendar</CommandItem>
						<CommandItem value="search">Search</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		);
	}

	test("SSR renders the input and items", async () => {
		const html = await renderStatic(<Demo />);
		expect(html).toContain('placeholder="Type a command..."');
		expect(html).toContain("Calendar");
		expect(html).toContain("Search");
	});

	test("hydrates without errors", async () => {
		const { errors, hydratedHtml } = await hydrate(<Demo />);
		expect(hydrationErrors(errors)).toEqual([]);
		expect(hydratedHtml).toContain("Calendar");
	});
});

describe("Resizable", () => {
	function Demo() {
		return (
			<ResizablePanelGroup direction="horizontal">
				<ResizablePanel defaultSize={40}>Left</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize={60}>Right</ResizablePanel>
			</ResizablePanelGroup>
		);
	}

	test("SSR renders panels at their defaultSize", async () => {
		const html = await renderStatic(<Demo />);
		expect(html).toContain("data-panel-group");
		expect(html).toContain("Left");
		expect(html).toContain("Right");
		expect(html).toContain('data-panel-size="40.0"');
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(<Demo />);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});
