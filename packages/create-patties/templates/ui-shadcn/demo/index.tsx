import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

// Links the compiled Tailwind sheet (served by app/routes/api/styles.ts). Every
// page route re-exports this so it renders styled — keep it on new pages too.
export { head } from "../components/_head.tsx";

// Whole-tree hydration: this page's entire React tree hydrates in the browser,
// so upstream shadcn/ui components work as written — function props, shared
// context, no island wrappers. Pages without this export ship zero JS.
export const hydrate = true;

export const meta = {
	title: "Welcome to Patties",
	description: "A Bun-native full-stack meta-framework.",
};

export default function Index() {
	const [saved, setSaved] = React.useState(0);
	return (
		<main className="mx-auto max-w-2xl space-y-4 p-8">
			<h1 className="font-semibold text-2xl">Welcome to Patties</h1>
			<p className="text-muted-foreground">
				This page is server-rendered, then hydrated as one React tree. The
				dialog below is upstream shadcn/ui, stamped verbatim into{" "}
				<code>app/components/ui/</code>.
			</p>
			<Dialog>
				<DialogTrigger asChild>
					<Button>Open dialog</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Hello from shadcn/ui</DialogTitle>
						<DialogDescription>
							Function props and shared context cross no island boundary here.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button onClick={() => setSaved((n) => n + 1)}>Save</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<p className="text-muted-foreground text-sm">Saved {saved} time(s).</p>
			<p className="text-muted-foreground text-sm">
				Add more with <code>bunx patties add @shadcn/&lt;name&gt;</code>.
			</p>
		</main>
	);
}
