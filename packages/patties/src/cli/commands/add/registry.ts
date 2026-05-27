import { components } from "patties-ui/registry";
import type { ComponentEntry } from "patties-ui/types";

export type { ComponentEntry } from "patties-ui/types";

export function listAll(): ComponentEntry[] {
	return components;
}

export function findByName(name: string): ComponentEntry | undefined {
	return components.find((c) => c.name === name);
}

export function completedComponents(): ComponentEntry[] {
	return components.filter((c) => c.status === "completed");
}
