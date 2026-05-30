import type { Plugin } from "../plugin/index.ts";
import { collect } from "./collect.ts";
import { render } from "./render.ts";

export interface ResolvedConfigLike {
	appDir?: string;
	env?: { required?: string[]; optional?: string[] };
	plugins?: Plugin[];
}

// Public entry point for spec 11. Caller writes the returned string to disk.
export async function generateAgentsMd(
	appDir: string,
	config: ResolvedConfigLike = {},
): Promise<string> {
	const envVars: Array<{
		name: string;
		required: boolean;
		description?: string;
	}> = [];
	for (const r of config.env?.required ?? [])
		envVars.push({ name: r, required: true });
	for (const o of config.env?.optional ?? [])
		envVars.push({ name: o, required: false });

	const data = await collect(appDir, envVars);
	let doc = { markdown: render(data) };

	for (const p of config.plugins ?? []) {
		const hook = p.hooks?.onAgentsMdGenerate;
		if (typeof hook !== "function") continue;
		try {
			doc = await hook(doc);
		} catch (err) {
			const msg = (err as Error)?.message ?? String(err);
			const wrapped = new Error(
				`[plugin ${p.name}] onAgentsMdGenerate: ${msg}`,
			);
			(wrapped as Error & { cause?: unknown }).cause = err;
			throw wrapped;
		}
	}
	return doc.markdown;
}
