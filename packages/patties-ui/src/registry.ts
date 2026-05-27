import type { ComponentEntry } from "./types.ts";

export const components: ComponentEntry[] = [
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
