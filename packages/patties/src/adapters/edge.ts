import type {
	Adapter,
	AdapterBuildInput,
	AdapterContext,
	EmittedArtifacts,
} from "./types.ts";

// Emits a portable WinterCG / workerd-style Worker module. The framework stays
// vendor-neutral: no wrangler.toml, vercel.json, etc. — those belong to deploy
// plugins. The bundled server entry already wraps itself in
// `export default { fetch }` via build/server-entry.ts::bootForEdge.
export const edgeAdapter: Adapter = {
	name: "edge",
	buildTarget: "browser",
	async emit(
		input: AdapterBuildInput,
		ctx: AdapterContext,
	): Promise<EmittedArtifacts> {
		// Surface the worker module under the canonical name spec 12 promises
		// (`dist/worker.js`). Bun.build wrote it as `<outDir>/server/server-entry.js`;
		// we re-emit it at `<outDir>/worker.js` so deploy plugins and ad-hoc CLIs
		// (`wrangler deploy <file>`) can find a predictable path.
		const workerPath = `${ctx.outDir}/worker.js`;
		if (!input.serverEntryOut) {
			// Edge never compiles, so stage-1 Bun.build always runs and sets this.
			throw new Error(
				"patties build: edge target requires a bundled server entry",
			);
		}
		const bytes = await Bun.file(input.serverEntryOut).bytes();
		await Bun.write(workerPath, bytes);
		return {
			serverEntry: workerPath,
			assets: input.assets,
			extraFiles: [workerPath],
		};
	},
};
