import { describe, expect, test } from "bun:test";
import { Alert, AlertDescription, AlertTitle } from "../templates/alert.tsx";
import { AspectRatio } from "../templates/aspect-ratio.tsx";
import { Badge } from "../templates/badge.tsx";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "../templates/breadcrumb.tsx";
import { ButtonGroup } from "../templates/button-group.tsx";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "../templates/card.tsx";
import { DirectionProvider } from "../templates/direction.tsx";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "../templates/empty.tsx";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "../templates/input-group.tsx";
import { Item, ItemContent, ItemMedia, ItemTitle } from "../templates/item.tsx";
import { Kbd, KbdGroup } from "../templates/kbd.tsx";
import { Label } from "../templates/label.tsx";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
} from "../templates/pagination.tsx";
import { Separator } from "../templates/separator.tsx";
import { Skeleton } from "../templates/skeleton.tsx";
import { Spinner } from "../templates/spinner.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../templates/table.tsx";
import { H1, InlineCode, List, P } from "../templates/typography.tsx";
import { renderStatic } from "./helpers/render-static.ts";

describe("Alert", () => {
	test("renders role=alert", async () => {
		const html = await renderStatic(
			<Alert>
				<AlertTitle>Heads up</AlertTitle>
				<AlertDescription>Body</AlertDescription>
			</Alert>,
		);
		expect(html).toContain('role="alert"');
		expect(html).toContain("Heads up");
		expect(html).toContain('data-slot="alert-description"');
	});

	test("destructive variant applies destructive token", async () => {
		const html = await renderStatic(<Alert variant="destructive">x</Alert>);
		expect(html).toContain("text-destructive");
	});
});

describe("AspectRatio", () => {
	test("emits inline aspect-ratio and relative position", async () => {
		const html = await renderStatic(<AspectRatio ratio={1.5}>x</AspectRatio>);
		expect(html).toContain("aspect-ratio:1.5");
		expect(html).toContain("position:relative");
	});

	test("invalid ratio falls back to 1", async () => {
		const html = await renderStatic(<AspectRatio ratio={0}>x</AspectRatio>);
		expect(html).toContain("aspect-ratio:1");
	});
});

describe("Badge", () => {
	test("variants apply token classes", async () => {
		expect(await renderStatic(<Badge>a</Badge>)).toContain("bg-primary");
		expect(await renderStatic(<Badge variant="secondary">a</Badge>)).toContain(
			"bg-secondary",
		);
		expect(
			await renderStatic(<Badge variant="destructive">a</Badge>),
		).toContain("bg-destructive");
		expect(await renderStatic(<Badge variant="outline">a</Badge>)).toContain(
			"text-foreground",
		);
	});

	test("renders a span by default", async () => {
		const html = await renderStatic(<Badge>a</Badge>);
		expect(html).toContain("<span");
	});

	test("asChild forwards classes to the child element", async () => {
		const html = await renderStatic(
			<Badge asChild>
				<a href="/x">link</a>
			</Badge>,
		);
		expect(html).toContain("<a");
		expect(html).toContain('href="/x"');
		expect(html).toContain("bg-primary");
		expect(html).not.toContain("<span");
	});
});

describe("Breadcrumb", () => {
	test("renders nav>ol with aria-current page", async () => {
		const html = await renderStatic(
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Home</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Now</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>,
		);
		expect(html).toContain('aria-label="breadcrumb"');
		expect(html).toContain("<ol");
		expect(html).toContain('aria-current="page"');
	});
});

describe("ButtonGroup", () => {
	test("role=group with data-orientation", async () => {
		const html = await renderStatic(<ButtonGroup>x</ButtonGroup>);
		expect(html).toContain('role="group"');
		expect(html).toContain('data-orientation="horizontal"');
	});

	test("vertical orientation flips layout", async () => {
		const html = await renderStatic(
			<ButtonGroup orientation="vertical">x</ButtonGroup>,
		);
		expect(html).toContain('data-orientation="vertical"');
		expect(html).toContain("flex-col");
	});
});

describe("Card", () => {
	test("renders the slot tree", async () => {
		const html = await renderStatic(
			<Card>
				<CardHeader>
					<CardTitle>Title</CardTitle>
				</CardHeader>
				<CardContent>Body</CardContent>
				<CardFooter>Foot</CardFooter>
			</Card>,
		);
		expect(html).toContain('data-slot="card"');
		expect(html).toContain('data-slot="card-title"');
		expect(html).toContain('data-slot="card-content"');
		expect(html).toContain('data-slot="card-footer"');
	});

	test("CardTitle asChild renders a heading element", async () => {
		const html = await renderStatic(
			<CardTitle asChild>
				<h2>Heading</h2>
			</CardTitle>,
		);
		expect(html).toContain("<h2");
		expect(html).toContain('data-slot="card-title"');
	});
});

describe("DirectionProvider", () => {
	test("renders children with no extra DOM wrapper", async () => {
		const html = await renderStatic(
			<DirectionProvider dir="rtl">
				<span>content</span>
			</DirectionProvider>,
		);
		expect(html).toBe("<span>content</span>");
	});
});

describe("Empty", () => {
	test("renders the slots", async () => {
		const html = await renderStatic(
			<Empty>
				<EmptyHeader>
					<EmptyTitle>None</EmptyTitle>
					<EmptyDescription>Nothing here</EmptyDescription>
				</EmptyHeader>
			</Empty>,
		);
		expect(html).toContain('data-slot="empty"');
		expect(html).toContain('data-slot="empty-title"');
		expect(html).toContain('data-slot="empty-description"');
	});
});

describe("InputGroup", () => {
	test("renders group, addon alignment and input", async () => {
		const html = await renderStatic(
			<InputGroup>
				<InputGroupAddon align="block-start">@</InputGroupAddon>
				<InputGroupInput placeholder="email" />
			</InputGroup>,
		);
		expect(html).toContain('role="group"');
		expect(html).toContain('data-align="block-start"');
		expect(html).toContain('data-slot="input-group-input"');
	});
});

describe("Item", () => {
	test("variant and size flow to data attributes", async () => {
		const html = await renderStatic(
			<Item variant="muted" size="sm">
				<ItemMedia variant="icon">i</ItemMedia>
				<ItemContent>
					<ItemTitle>Row</ItemTitle>
				</ItemContent>
			</Item>,
		);
		expect(html).toContain('data-variant="muted"');
		expect(html).toContain('data-size="sm"');
		expect(html).toContain('data-slot="item-media"');
	});

	test("asChild renders an anchor", async () => {
		const html = await renderStatic(
			<Item asChild>
				<a href="/x">row</a>
			</Item>,
		);
		expect(html).toContain("<a");
		expect(html).toContain('data-slot="item"');
	});
});

describe("Kbd", () => {
	test("renders a kbd element inside a group", async () => {
		const html = await renderStatic(
			<KbdGroup>
				<Kbd>Ctrl</Kbd>
				<Kbd>K</Kbd>
			</KbdGroup>,
		);
		expect(html).toContain("<kbd");
		expect(html).toContain('data-slot="kbd-group"');
		expect(html).toContain("Ctrl");
	});
});

describe("Label", () => {
	test("associates with a control via htmlFor", async () => {
		const html = await renderStatic(<Label htmlFor="email">Email</Label>);
		expect(html).toContain('for="email"');
		expect(html).toContain('data-slot="label"');
	});
});

describe("Pagination", () => {
	test("renders nav>ul and marks the active link", async () => {
		const html = await renderStatic(
			<Pagination>
				<PaginationContent>
					<PaginationItem>
						<PaginationLink href="/1" isActive>
							1
						</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="/2">2</PaginationLink>
					</PaginationItem>
				</PaginationContent>
			</Pagination>,
		);
		expect(html).toContain('aria-label="pagination"');
		expect(html).toContain("<ul");
		expect(html).toContain('aria-current="page"');
	});
});

describe("Separator", () => {
	test("decorative omits role=separator", async () => {
		const html = await renderStatic(<Separator />);
		expect(html).not.toContain('role="separator"');
		expect(html).toContain('data-slot="separator"');
	});

	test("non-decorative exposes role and orientation", async () => {
		const html = await renderStatic(
			<Separator decorative={false} orientation="vertical" />,
		);
		expect(html).toContain('role="separator"');
		expect(html).toContain('aria-orientation="vertical"');
	});
});

describe("Skeleton", () => {
	test("animates with reduced-motion fallback", async () => {
		const html = await renderStatic(<Skeleton className="h-4 w-10" />);
		expect(html).toContain("animate-pulse");
		expect(html).toContain("motion-reduce:animate-none");
	});
});

describe("Spinner", () => {
	test("status role and reduced-motion", async () => {
		const html = await renderStatic(<Spinner />);
		expect(html).toContain('role="status"');
		expect(html).toContain("animate-spin");
		expect(html).toContain("motion-reduce:animate-none");
	});

	test("sizes map to size utilities", async () => {
		expect(await renderStatic(<Spinner size="sm" />)).toContain("size-4");
		expect(await renderStatic(<Spinner size="lg" />)).toContain("size-6");
	});
});

describe("Table", () => {
	test("wraps in an overflow container and renders cells", async () => {
		const html = await renderStatic(
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>Patties</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		expect(html).toContain('data-slot="table-container"');
		expect(html).toContain("overflow-x-auto");
		expect(html).toContain("<table");
		expect(html).toContain("<th");
		expect(html).toContain("<td");
	});
});

describe("Typography", () => {
	test("renders semantic elements with scale classes", async () => {
		expect(await renderStatic(<H1>Title</H1>)).toContain("<h1");
		expect(await renderStatic(<H1>Title</H1>)).toContain("text-4xl");
		expect(await renderStatic(<P>para</P>)).toContain("<p");
		expect(await renderStatic(<InlineCode>x</InlineCode>)).toContain("<code");
		expect(await renderStatic(<List>x</List>)).toContain("<ul");
	});
});
