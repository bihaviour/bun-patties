import { z } from "zod"

export const PattiesConfigSchema = z.object({
  target: z.enum(["bun", "edge"]).default("bun"),
  appDir: z.string().default("./app"),
  outDir: z.string().default("./.patties"),
  plugins: z.array(z.unknown()).default([]),
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
})

export type PattiesConfig = z.infer<typeof PattiesConfigSchema>
export type PattiesConfigInput = z.input<typeof PattiesConfigSchema>
