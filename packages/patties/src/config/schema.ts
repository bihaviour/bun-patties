import { z } from "zod";
import type { Plugin } from "../plugin/index.ts";

const PluginSchema = z.custom<Plugin>(
	(v) =>
		typeof v === "object" &&
		v !== null &&
		typeof (v as { name?: unknown }).name === "string",
	{ message: "plugin must be an object with a `name: string`" },
);

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
	// Generated agent-manifest target(s). Defaults to "AGENTS.md" for
	// agent-tool-agnostic projects; set to "CLAUDE.md" (or an array) to land
	// the manifest where your agent of choice already reads instructions from.
	agentsMd: z
		.object({
			path: z
				.union([z.string(), z.array(z.string()).min(1)])
				.default("AGENTS.md"),
		})
		.default({ path: "AGENTS.md" }),
});

export type PattiesConfig = z.infer<typeof PattiesConfigSchema>;
export type PattiesConfigInput = z.input<typeof PattiesConfigSchema>;
