import { z } from "zod";
import type { Plugin } from "../plugin/index.ts";

const PluginSchema = z.custom<Plugin>(
	(v) =>
		typeof v === "object" &&
		v !== null &&
		typeof (v as { name?: unknown }).name === "string",
	{ message: "plugin must be an object with a `name: string`" },
);

// Optional UI-scaffolding overrides. Everything not listed here stays a fixed
// convention (style, baseColor, cssVariables, rsc, aliases, iconLibrary) — see
// framework/25-ui-config-block. `.strict()` so an unknown key (e.g. `aliases`)
// is a config error pointing the user at the convention it replaces. Paths are
// kept relative here; the project-root-escape guard lives in `resolveUiPaths`.
export const UiConfigSchema = z
	.object({
		componentsDir: z.string().default("app/components/ui"),
		internalDir: z.string().optional(),
		tokensFile: z.string().default("app/styles/tokens.css"),
	})
	.strict();

export type UiConfig = z.infer<typeof UiConfigSchema>;

export const PattiesConfigSchema = z.object({
	target: z.enum(["bun", "edge"]).default("bun"),
	appDir: z.string().default("./app"),
	outDir: z.string().default("./.patties"),
	plugins: z.array(PluginSchema).default([]),
	env: z
		.object({
			required: z.array(z.string()).default([]),
			public: z.array(z.string()).default([]),
		})
		.default({ required: [], public: [] }),
	secrets: z.array(z.string()).default([]),
	server: z
		.object({
			port: z.number().int().min(0).default(3000),
			hostname: z.string().default("0.0.0.0"),
			unix: z.string().optional(),
			reusePort: z.boolean().optional(),
		})
		.default({ port: 3000, hostname: "0.0.0.0" }),
	adapter: z
		.object({
			bun: z
				.object({
					compile: z.boolean().default(false),
				})
				.default({ compile: false }),
		})
		.default({ bun: { compile: false } }),
	// Generated agent-manifest target(s). Defaults to "CLAUDE.md" so the
	// manifest lands in the same file Claude already reads. The CLI splices
	// the manifest between fenced markers so any human-written content
	// (rules, notes) around the section is preserved across regenerations.
	// Use an array to write the same manifest to multiple files
	// (e.g. ["CLAUDE.md", "AGENTS.md"]).
	agentsMd: z
		.object({
			path: z
				.union([z.string(), z.array(z.string()).min(1)])
				.default("CLAUDE.md"),
		})
		.default({ path: "CLAUDE.md" }),
	// Optional, no default: absent must behave exactly as today (conventions only).
	ui: UiConfigSchema.optional(),
});

export type PattiesConfig = z.infer<typeof PattiesConfigSchema>;
export type PattiesConfigInput = z.input<typeof PattiesConfigSchema>;
