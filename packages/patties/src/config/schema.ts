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
		// Third-party registries for namespaced installs (`patties add @acme/x`).
		// Keys are `@namespace`; values are an https base URL or a local path that
		// `patties ui build` produced. The built-in patties-ui catalog is always
		// available unprefixed and needs no entry. See cli/15.
		registries: z.record(z.string().regex(/^@/), z.string()).optional(),
	})
	.strict();

export type UiConfig = z.infer<typeof UiConfigSchema>;

// Per-task cache config for `patties run` (framework/27-task-runner-cache).
// `.strict()` so a typo (e.g. `output` for `outputs`, or a `dependsOn` field —
// ordering is owned by the workspace graph, not a DSL) is a config error.
// All fields optional: a bare `{}` means "cache with default inputs (the
// package's tracked + untracked-non-ignored files minus `outputs`) and no
// declared outputs to restore".
export const TaskConfigSchema = z
	.object({
		inputs: z.array(z.string()).optional(),
		outputs: z.array(z.string()).optional(),
		env: z.array(z.string()).optional(),
		cache: z.boolean().optional(),
	})
	.strict();

export type TaskConfig = z.infer<typeof TaskConfigSchema>;

export const TasksConfigSchema = z.record(z.string(), TaskConfigSchema);

export type TasksConfig = z.infer<typeof TasksConfigSchema>;

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
	// Per-task input/output declarations consumed by `patties run` (the cache
	// layer). Absent ⇒ `patties run <task>` falls back to per-task defaults.
	tasks: TasksConfigSchema.optional(),
});

export type PattiesConfig = z.infer<typeof PattiesConfigSchema>;
export type PattiesConfigInput = z.input<typeof PattiesConfigSchema>;
