import TodoApp from "../islands/TodoApp.tsx";

export default function Index(): JSX.Element {
	return (
		<main>
			<h1>Welcome to Patties</h1>
			<p>
				This page is server-rendered. The list below is a client island —{" "}
				<code>app/islands/TodoApp.tsx</code> — hydrated in the browser.
			</p>
			<TodoApp />
			<hr />
			<p>
				<small>
					When you're ready to start your real app, see the "Remove the demo"
					section of <code>README.md</code>.
				</small>
			</p>
		</main>
	);
}
