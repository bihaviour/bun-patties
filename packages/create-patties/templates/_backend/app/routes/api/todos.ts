import type { PattiesContext } from "patties/middleware";

// A small in-memory sample resource so a backend project boots with a working
// endpoint. Swap the array for a real data source when you're ready.
interface Todo {
	id: number;
	text: string;
	done: boolean;
}

const todos: Todo[] = [
	{ id: 1, text: "wire up a database", done: false },
	{ id: 2, text: "add authentication", done: false },
];

export function GET(_req: Request, ctx: PattiesContext): Response {
	return ctx.json({ todos });
}

export async function POST(
	req: Request,
	ctx: PattiesContext,
): Promise<Response> {
	const body = (await req.json()) as { text?: unknown };
	const text = typeof body.text === "string" ? body.text.trim() : "";
	if (!text) return ctx.json({ error: "text is required" }, { status: 400 });
	const todo: Todo = { id: todos.length + 1, text, done: false };
	todos.push(todo);
	return ctx.json({ todo }, { status: 201 });
}
