import Counter from "../islands/counter.tsx";

export const meta = { title: "Edge Smoke" };

export default function Home() {
	return (
		<div>
			<h1>edge smoke</h1>
			<Counter start={1} />
		</div>
	);
}
