import type { z } from "zod";
import type {
	ComponentEntrySchema,
	ComponentFileSchema,
	InternalHelperSchema,
	IslandSchema,
	KindSchema,
	PhaseSchema,
	StatusSchema,
} from "./schema.ts";

export type Island = z.infer<typeof IslandSchema>;
export type Kind = z.infer<typeof KindSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type InternalHelper = z.infer<typeof InternalHelperSchema>;

export type ComponentFile = z.infer<typeof ComponentFileSchema>;
export type ComponentEntry = z.infer<typeof ComponentEntrySchema>;
