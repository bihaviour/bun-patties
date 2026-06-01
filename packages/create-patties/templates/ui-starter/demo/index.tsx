import { Island } from "patties/render";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card.tsx";
import TodoApp from "../islands/TodoApp.tsx";

// Links the compiled Tailwind sheet (served by app/routes/api/styles.ts). Every
// page route re-exports this so it renders styled — keep it on new pages too.
export { head } from "../components/_head.tsx";

export const meta = {
	title: "Welcome to Patties",
	description: "A Bun-native full-stack meta-framework.",
};

export default function Index() {
	return (
		<main className="mx-auto max-w-2xl p-8">
			<Card>
				<CardHeader>
					<CardTitle>Welcome to Patties</CardTitle>
					<CardDescription>
						This page is server-rendered with Patties UI components. The list
						below is a client island — <code>app/islands/TodoApp.tsx</code> —
						hydrated in the browser.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Island name="TodoApp">
						<TodoApp />
					</Island>
				</CardContent>
			</Card>
			<p className="mt-4 text-muted-foreground text-sm">
				Components live in <code>app/components/ui/</code>. Add more with
				<code>patties add</code>, or ask your coding agent via{" "}
				<code>/patties</code>.
			</p>
		</main>
	);
}
