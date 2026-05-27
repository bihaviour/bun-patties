import type { ComponentEntry } from "./types.ts";

export type { ComponentEntry } from "./types.ts";

const components: ComponentEntry[] = [
	{
		name: "hello",
		spec: "ui/phase-0/00-cli-add#fixture",
		phase: 0,
		kind: "primitive",
		island: "no",
		status: "completed",
		files: [{ from: "__fixtures__/hello.tsx", to: "hello.tsx" }],
		peerDeps: {},
		internalHelpers: ["cn"],
		tokens: ["base"],
	},
];

export function listAll(): ComponentEntry[] {
	return components;
}

export function findByName(name: string): ComponentEntry | undefined {
	return components.find((c) => c.name === name);
}

export function completedComponents(): ComponentEntry[] {
	return components.filter((c) => c.status === "completed");
}
