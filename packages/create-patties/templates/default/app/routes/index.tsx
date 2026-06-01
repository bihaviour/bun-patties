import { Island } from "patties/render";
import TodoApp from "../islands/TodoApp.tsx";

export const meta = {
	title: "Welcome to Patties",
	description: "A Bun-native full-stack meta-framework.",
};

export default function Index() {
	return (
		<main>
			<h1>Welcome to Patties</h1>
			<p>
				This page is server-rendered. The list below is a client island —{" "}
				<code>app/islands/TodoApp.tsx</code> — hydrated in the browser.
			</p>
			<Island name="TodoApp">
				<TodoApp />
			</Island>
			<hr />
			<p>
				<small>
					When you're ready, replace this page — or run{" "}
					<code>/patties-init</code> to scaffold your first real feature.
				</small>
			</p>
		</main>
	);
}
