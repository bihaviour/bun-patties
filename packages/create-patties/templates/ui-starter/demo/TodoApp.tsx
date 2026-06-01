"use client";

import { useState } from "react";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";

interface Todo {
	id: number;
	text: string;
	done: boolean;
}

export default function TodoApp() {
	const [todos, setTodos] = useState<Todo[]>([
		{ id: 1, text: "edit app/routes/index.tsx", done: false },
		{ id: 2, text: "edit app/islands/TodoApp.tsx", done: false },
		{ id: 3, text: "add a component with `patties add`", done: false },
	]);
	const [draft, setDraft] = useState("");

	function add(): void {
		const text = draft.trim();
		if (!text) return;
		setTodos([...todos, { id: Date.now(), text, done: false }]);
		setDraft("");
	}

	function toggle(id: number): void {
		setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
	}

	function remove(id: number): void {
		setTodos(todos.filter((t) => t.id !== id));
	}

	return (
		<section aria-label="Todo demo" className="flex flex-col gap-3">
			<form
				className="flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					add();
				}}
			>
				<Input
					type="text"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder="What needs doing?"
					aria-label="New todo"
				/>
				<Button type="submit">Add</Button>
			</form>
			<ul className="flex flex-col gap-2">
				{todos.map((t) => (
					<li key={t.id} className="flex items-center gap-2">
						<label className="flex flex-1 items-center gap-2">
							<input
								type="checkbox"
								checked={t.done}
								onChange={() => toggle(t.id)}
							/>
							<span
								className={t.done ? "text-muted-foreground line-through" : ""}
							>
								{t.text}
							</span>
						</label>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => remove(t.id)}
							aria-label="Remove"
						>
							×
						</Button>
					</li>
				))}
			</ul>
			<p className="text-muted-foreground text-sm">
				{todos.filter((t) => !t.done).length} of {todos.length} remaining
			</p>
		</section>
	);
}
