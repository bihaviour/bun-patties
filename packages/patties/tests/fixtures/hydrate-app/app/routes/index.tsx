import { Link } from "patties/client";
import { CounterButton, CounterRoot } from "../components/counter.tsx";
import { readStart } from "../lib/db.server.ts";

export const hydrate = true;
export const meta = { title: "Hydrated Home" };

interface Data {
	start: number;
	at: Date;
}

export function loader(): Data {
	return { start: readStart(), at: new Date("2026-01-02T03:04:05.000Z") };
}

export function serialize(data: Data) {
	return { start: data.start, at: data.at.toISOString() };
}

export function deserialize(json: { start: number; at: string }): Data {
	return { start: json.start, at: new Date(json.at) };
}

export default function Home({ data }: { data: Data }) {
	return (
		<main>
			<h1>home</h1>
			<p id="at">{data.at.getUTCFullYear()}</p>
			<CounterRoot start={data.start}>
				<CounterButton />
			</CounterRoot>
			<Link href="/users/7">user 7</Link>
		</main>
	);
}
