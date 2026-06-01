"use client";

import { useState } from "react";

interface Todo {
	id: number;
	text: string;
	done: boolean;
}

export default function TodoApp() {
	const [todos, setTodos] = useState<Todo[]>([
		{ id: 1, text: "edit app/routes/index.tsx", done: false },
		{ id: 2, text: "edit app/islands/TodoApp.tsx", done: false },
		{ id: 3, text: "delete this demo when you're ready", done: false },
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
		<section aria-label="Todo demo">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					add();
				}}
			>
				<input
					type="text"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder="What needs doing?"
					aria-label="New todo"
				/>
				<button type="submit">Add</button>
			</form>
			<ul>
				{todos.map((t) => (
					<li key={t.id}>
						<label>
							<input
								type="checkbox"
								checked={t.done}
								onChange={() => toggle(t.id)}
							/>
							<span
								style={{ textDecoration: t.done ? "line-through" : "none" }}
							>
								{t.text}
							</span>
						</label>
						<button
							type="button"
							onClick={() => remove(t.id)}
							aria-label="Remove"
						>
							×
						</button>
					</li>
				))}
			</ul>
			<p>
				<small>
					{todos.filter((t) => !t.done).length} of {todos.length} remaining
				</small>
			</p>
		</section>
	);
}
