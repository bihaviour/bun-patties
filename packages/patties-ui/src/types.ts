export type Island = "no" | "yes" | "subtree" | "yes-downgrade";
export type Kind = "primitive" | "recipe" | "provider";
export type Status = "draft" | "completed";
export type Phase = 0 | 1 | 2 | 3 | 4;
export type InternalHelper = "cn" | "slot" | "variants";

export interface ComponentFile {
	from: string;
	to: string;
}

export interface ComponentEntry {
	name: string;
	spec: string;
	phase: Phase;
	kind: Kind;
	island: Island;
	status: Status;
	files: ComponentFile[];
	peerDeps: Record<string, string>;
	internalHelpers: InternalHelper[];
	tokens?: string[];
}
