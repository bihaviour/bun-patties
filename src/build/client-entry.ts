import type { IslandEntry } from "./scan-islands.ts";

export interface ClientEntryOptions {
	// Absolute path to the framework's `src/` root. Used to import `client/index.ts`
	// via an absolute path so the generated entry resolves correctly from genDir,
	// independent of where the fixture/app sits in the node_modules tree.
	frameworkRoot: string;
}

export function generateClientEntry(
	islands: IslandEntry[],
	options: ClientEntryOptions,
): string {
	if (islands.length === 0) {
		// Empty entry — Bun.build will produce a near-empty bundle. Build()
		// short-circuits before invoking Bun.build for the zero-island case, but
		// the file is still generated so dev paths can reference it uniformly.
		return `export {}\n`;
	}

	const clientModule = `${options.frameworkRoot}/client/index.ts`;

	const imports = islands
		.map((i, idx) => `import I${idx} from ${JSON.stringify(i.filePath)}`)
		.join("\n");

	const registrations = islands
		.map((i, idx) => `client.register(${JSON.stringify(i.name)}, I${idx})`)
		.join("\n");

	return `import { createClient } from ${JSON.stringify(clientModule)}
${imports}

const client = createClient()
${registrations}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => client.hydrateAll())
} else {
  client.hydrateAll()
}
`;
}
