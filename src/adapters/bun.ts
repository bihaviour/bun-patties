import type {
	Adapter,
	AdapterBuildInput,
	AdapterContext,
	EmittedArtifacts,
} from "./types.ts";

export const bunAdapter: Adapter = {
	name: "bun",
	buildTarget: "bun",
	async emit(
		input: AdapterBuildInput,
		ctx: AdapterContext,
	): Promise<EmittedArtifacts> {
		let serverEntry = input.serverEntryOut;
		if (ctx.compile && ctx.mode === "production") {
			const exePath = ctx.outDir + "/server-bin";
			const proc = Bun.spawn({
				cmd: [
					"bun",
					"build",
					"--compile",
					"--outfile",
					exePath,
					input.serverEntryOut,
				],
				stdout: "pipe",
				stderr: "pipe",
			});
			const code = await proc.exited;
			if (code !== 0) {
				const err = await new Response(proc.stderr).text();
				throw new Error(
					"patties build: --compile failed (exit " + code + ")\n" + err,
				);
			}
			serverEntry = exePath;
		}
		return { serverEntry, assets: input.assets };
	},
};
