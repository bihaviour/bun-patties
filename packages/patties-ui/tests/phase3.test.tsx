import { describe, expect, test } from "bun:test";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../templates/accordion.tsx";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "../templates/alert-dialog.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "../templates/avatar.tsx";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../templates/collapsible.tsx";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "../templates/context-menu.tsx";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "../templates/dialog.tsx";
import { Drawer, DrawerContent, DrawerTrigger } from "../templates/drawer.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../templates/dropdown-menu.tsx";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "../templates/hover-card.tsx";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "../templates/input-otp.tsx";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "../templates/menubar.tsx";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
} from "../templates/navigation-menu.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "../templates/popover.tsx";
import { ScrollArea } from "../templates/scroll-area.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../templates/select.tsx";
import { Sheet, SheetContent, SheetTrigger } from "../templates/sheet.tsx";
import { Toaster } from "../templates/sonner.tsx";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../templates/tabs.tsx";
import {
	Toast,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "../templates/toast.tsx";
import { ToggleGroup, ToggleGroupItem } from "../templates/toggle-group.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../templates/tooltip.tsx";
import { hydrate } from "./helpers/hydrate.ts";
import { renderStatic } from "./helpers/render-static.ts";

// Running react-dom/server then react-dom/client in one process makes React warn
// about "multiple renderers" for any shared (Radix) context. It's a test-harness
// artifact, not a hydration-mismatch defect, so we ignore it when asserting.
const BENIGN = ["Detected multiple renderers concurrently"];
function hydrationErrors(errors: string[]): string[] {
	return errors.filter((e) => !BENIGN.some((b) => e.includes(b)));
}

describe("Accordion", () => {
	const tree = (
		<Accordion type="single" collapsible>
			<AccordionItem value="a">
				<AccordionTrigger>Section A</AccordionTrigger>
				<AccordionContent>Body A</AccordionContent>
			</AccordionItem>
		</Accordion>
	);

	test("SSR renders items collapsed", async () => {
		const html = await renderStatic(tree);
		expect(html).toContain("Section A");
		expect(html).toContain('data-state="closed"');
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(tree);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("AlertDialog", () => {
	test("SSR renders only the trigger; content is absent", async () => {
		const html = await renderStatic(
			<AlertDialog>
				<AlertDialogTrigger>Delete</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogTitle>Sure?</AlertDialogTitle>
				</AlertDialogContent>
			</AlertDialog>,
		);
		expect(html).toContain("Delete");
		expect(html).not.toContain("Sure?");
	});
});

describe("Avatar", () => {
	const tree = (
		<Avatar>
			<AvatarImage src="/nope.png" alt="user" />
			<AvatarFallback>AB</AvatarFallback>
		</Avatar>
	);

	test("SSR paints the fallback, not an <img>", async () => {
		const html = await renderStatic(tree);
		expect(html).toContain("AB");
		expect(html).not.toContain("<img");
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(tree);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Collapsible", () => {
	test("defaultOpen renders content visible on the server", async () => {
		const html = await renderStatic(
			<Collapsible defaultOpen>
				<CollapsibleTrigger>Toggle</CollapsibleTrigger>
				<CollapsibleContent>Revealed</CollapsibleContent>
			</Collapsible>,
		);
		expect(html).toContain("Revealed");
		expect(html).toContain('data-state="open"');
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(
			<Collapsible>
				<CollapsibleTrigger>Toggle</CollapsibleTrigger>
				<CollapsibleContent>Revealed</CollapsibleContent>
			</Collapsible>,
		);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("ContextMenu", () => {
	test("SSR renders only the trigger area", async () => {
		const html = await renderStatic(
			<ContextMenu>
				<ContextMenuTrigger>Right-click me</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem>Copy</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>,
		);
		expect(html).toContain("Right-click me");
		expect(html).not.toContain("Copy");
	});
});

describe("Dialog", () => {
	const tree = (
		<Dialog>
			<DialogTrigger>Open</DialogTrigger>
			<DialogContent>
				<DialogTitle>Title</DialogTitle>
			</DialogContent>
		</Dialog>
	);

	test("SSR contains only the trigger", async () => {
		const html = await renderStatic(tree);
		expect(html).toContain("Open");
		expect(html).not.toContain("Title");
	});

	test("closed dialog hydrates without errors", async () => {
		const { errors } = await hydrate(tree);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Drawer", () => {
	test("SSR renders only the trigger", async () => {
		const html = await renderStatic(
			<Drawer>
				<DrawerTrigger>Open drawer</DrawerTrigger>
				<DrawerContent>Drawer body</DrawerContent>
			</Drawer>,
		);
		expect(html).toContain("Open drawer");
		expect(html).not.toContain("Drawer body");
	});
});

describe("DropdownMenu", () => {
	test("SSR renders only the trigger", async () => {
		const html = await renderStatic(
			<DropdownMenu>
				<DropdownMenuTrigger>Menu</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Profile</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		expect(html).toContain("Menu");
		expect(html).not.toContain("Profile");
	});
});

describe("HoverCard", () => {
	test("SSR renders only the trigger", async () => {
		const html = await renderStatic(
			<HoverCard>
				<HoverCardTrigger>@patties</HoverCardTrigger>
				<HoverCardContent>Preview body</HoverCardContent>
			</HoverCard>,
		);
		expect(html).toContain("@patties");
		expect(html).not.toContain("Preview body");
	});
});

describe("InputOTP", () => {
	const tree = (
		<InputOTP maxLength={4}>
			<InputOTPGroup>
				<InputOTPSlot index={0} />
				<InputOTPSlot index={1} />
				<InputOTPSlot index={2} />
				<InputOTPSlot index={3} />
			</InputOTPGroup>
		</InputOTP>
	);

	test("SSR renders a hidden input for native submit", async () => {
		const html = await renderStatic(tree);
		expect(html).toContain("<input");
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(tree);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Menubar", () => {
	test("SSR renders the menubar and triggers, menus closed", async () => {
		const html = await renderStatic(
			<Menubar>
				<MenubarMenu>
					<MenubarTrigger>File</MenubarTrigger>
					<MenubarContent>
						<MenubarItem>New Tab</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>,
		);
		expect(html).toContain('role="menubar"');
		expect(html).toContain("File");
		expect(html).not.toContain("New Tab");
	});
});

describe("NavigationMenu", () => {
	test("bare links render as anchors that work without JS", async () => {
		const html = await renderStatic(
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuLink href="/docs">Docs</NavigationMenuLink>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>,
		);
		expect(html).toContain("<a");
		expect(html).toContain('href="/docs"');
		expect(html).toContain("Docs");
	});
});

describe("Popover", () => {
	test("SSR renders only the trigger", async () => {
		const html = await renderStatic(
			<Popover>
				<PopoverTrigger>Open popover</PopoverTrigger>
				<PopoverContent>Floating body</PopoverContent>
			</Popover>,
		);
		expect(html).toContain("Open popover");
		expect(html).not.toContain("Floating body");
	});
});

describe("ScrollArea", () => {
	test("viewport has native overflow for the no-JS fallback", async () => {
		const html = await renderStatic(
			<ScrollArea className="h-24">
				<p>Scrollable content</p>
			</ScrollArea>,
		);
		expect(html).toContain("overflow-auto");
		expect(html).toContain("Scrollable content");
	});
});

describe("Select", () => {
	test("SSR renders the trigger with its placeholder; listbox closed", async () => {
		const html = await renderStatic(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Pick one" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Apple</SelectItem>
				</SelectContent>
			</Select>,
		);
		expect(html).toContain("Pick one");
		expect(html).not.toContain("Apple");
	});
});

describe("Sheet", () => {
	test("SSR renders only the trigger", async () => {
		const html = await renderStatic(
			<Sheet>
				<SheetTrigger>Open sheet</SheetTrigger>
				<SheetContent side="right">Sheet body</SheetContent>
			</Sheet>,
		);
		expect(html).toContain("Open sheet");
		expect(html).not.toContain("Sheet body");
	});
});

describe("Sonner", () => {
	test("Toaster renders on the server and hydrates without errors", async () => {
		await renderStatic(<Toaster />);
		const { errors } = await hydrate(<Toaster />);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Tabs", () => {
	const tree = (
		<Tabs defaultValue="a">
			<TabsList>
				<TabsTrigger value="a">Tab A</TabsTrigger>
				<TabsTrigger value="b">Tab B</TabsTrigger>
			</TabsList>
			<TabsContent value="a">Panel A</TabsContent>
			<TabsContent value="b">Panel B</TabsContent>
		</Tabs>
	);

	test("SSR shows the defaultValue panel only", async () => {
		const html = await renderStatic(tree);
		expect(html).toContain("Panel A");
		expect(html).not.toContain("Panel B");
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(tree);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Toast", () => {
	const tree = (
		<ToastProvider>
			<Toast open>
				<ToastTitle>Saved</ToastTitle>
			</Toast>
			<ToastViewport />
		</ToastProvider>
	);

	test("SSR renders the notifications viewport region", async () => {
		const html = await renderStatic(tree);
		expect(html).toContain('role="region"');
		expect(html).toContain("Notifications");
	});

	test("the open toast title appears after hydration", async () => {
		const { errors, hydratedHtml } = await hydrate(tree);
		expect(hydrationErrors(errors)).toEqual([]);
		expect(hydratedHtml).toContain("Saved");
	});
});

describe("ToggleGroup", () => {
	const tree = (
		<ToggleGroup type="single" defaultValue="a">
			<ToggleGroupItem value="a" aria-label="a">
				A
			</ToggleGroupItem>
			<ToggleGroupItem value="b" aria-label="b">
				B
			</ToggleGroupItem>
		</ToggleGroup>
	);

	test("single mode marks the default item pressed", async () => {
		const html = await renderStatic(tree);
		expect(html).toContain('data-state="on"');
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(tree);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Tooltip", () => {
	test("SSR renders only the trigger", async () => {
		const html = await renderStatic(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>Tip text</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);
		expect(html).toContain("Hover me");
		expect(html).not.toContain("Tip text");
	});
});
