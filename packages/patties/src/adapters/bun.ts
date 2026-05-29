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
		if (ctx.compile && ctx.mode === "production") {
			const exePath = `${ctx.outDir}/server-bin`;
			// Compile the SOURCE entry, not the stage-1 bundle: `with { type: "file" }`
			// and `with { type: "macro" }` attributes only survive into --compile when
			// the compiler sees the source. The source transitively imports the
			// generated embedded-manifest.ts, so all assets land in the binary.
			const proc = Bun.spawn({
				cmd: [
					"bun",
					"build",
					"--compile",
					"--outfile",
					exePath,
					input.serverEntrySrc,
				],
				stdout: "pipe",
				stderr: "pipe",
			});
			const code = await proc.exited;
			if (code !== 0) {
				const err = await new Response(proc.stderr).text();
				throw new Error(
					`patties build: --compile failed (exit ${code})\n${err}`,
				);
			}
			// Single-file deploy: assets + client chunks are embedded; drop the
			// on-disk sidecars so the binary is the whole artifact.
			await Bun.$`rm -rf ${`${ctx.outDir}/server`}`.quiet();
			await Bun.$`rm -rf ${`${ctx.outDir}/client`}`.quiet();
			await Bun.$`rm -rf ${`${ctx.outDir}/assets`}`.quiet();
			return { serverEntry: exePath, assets: [] };
		}
		if (!input.serverEntryOut) {
			throw new Error(
				"patties build: bun target requires a bundled server entry",
			);
		}
		return { serverEntry: input.serverEntryOut, assets: input.assets };
	},
};
