import { z } from "zod";

// Runtime validator for catalog entries. `types.ts` re-derives its exported
// types from these schemas, so the schema is the single source of truth — the
// CLI uses it to validate fetched/built third-party registries (cli/15).

export const IslandSchema = z.enum(["no", "yes", "subtree", "yes-downgrade"]);
export const KindSchema = z.enum(["primitive", "recipe", "provider"]);
export const StatusSchema = z.enum(["draft", "completed"]);
export const PhaseSchema = z.union([
	z.literal(0),
	z.literal(1),
	z.literal(2),
	z.literal(3),
	z.literal(4),
]);
export const InternalHelperSchema = z.enum(["cn", "slot", "variants"]);

export const ComponentFileSchema = z
	.object({
		from: z.string(),
		to: z.string(),
	})
	.strict();

export const ComponentEntrySchema = z
	.object({
		name: z.string(),
		spec: z.string(),
		phase: PhaseSchema,
		kind: KindSchema,
		island: IslandSchema,
		status: StatusSchema,
		files: z.array(ComponentFileSchema),
		peerDeps: z.record(z.string(), z.string()),
		internalHelpers: z.array(InternalHelperSchema),
		tokens: z.array(z.string()).optional(),
	})
	.strict();
