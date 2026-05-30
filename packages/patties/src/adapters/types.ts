import type { BuiltAsset } from "../build/assets.ts";
import type { PattiesConfig } from "../config/schema.ts";

export interface AdapterContext {
	appDir: string;
	outDir: string;
	mode: "development" | "production";
	config?: PattiesConfig;
	compile?: boolean;
}

export interface AdapterBuildInput {
	/** Absolute path to the bundled server entry produced by stage-1 Bun.build.
	 * Undefined in bun compile mode, where stage-1 is skipped and the adapter
	 * compiles `serverEntrySrc` directly so file/macro import attributes survive. */
	serverEntryOut?: string;
	/** Absolute path to the generated server-entry.ts SOURCE (for --compile). */
	serverEntrySrc: string;
	assets: BuiltAsset[];
}

export interface EmittedArtifacts {
	/**
	 * Absolute path to the consumable server entry after the adapter's
	 * post-processing (e.g. compiled binary for bun, worker.js for edge).
	 */
	serverEntry: string;
	assets: BuiltAsset[];
	extraFiles?: string[];
}

export interface Adapter {
	name: "edge" | "bun";
	buildTarget: "browser" | "bun";
	emit(
		input: AdapterBuildInput,
		ctx: AdapterContext,
	): Promise<EmittedArtifacts>;
}
