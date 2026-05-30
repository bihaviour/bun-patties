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

// `from`/`to` here and registry `templates` keys are joined against temp dirs
// and the project's components/internal dirs when stamping fetched or
// third-party registries. Reject anything that could escape the destination:
// absolute paths, drive letters, backslashes, `..` segments, or null bytes.
// Exported so the registry payload schema can reuse it for `templates` keys.
export const SafeRelPath = z
	.string()
	.refine(
		(p) =>
			p.length > 0 &&
			!p.includes("\0") &&
			!p.includes("\\") &&
			!p.startsWith("/") &&
			!/^[a-zA-Z]:/.test(p) &&
			!p.split("/").some((seg) => seg === ".."),
		{
			message:
				"unsafe path: must be relative, without '..' segments, backslashes, drive letters, or null bytes",
		},
	);

export const ComponentFileSchema = z
	.object({
		from: SafeRelPath,
		to: SafeRelPath,
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
