import { dirname, join, relative } from "node:path";
import { log } from "../../log.ts";
import { INTERNAL_FILES } from "../add/internal.ts";
import type { UiPaths } from "../add/ui-paths.ts";

// `patties ui init --shadcn`: the project wiring upstream shadcn/ui source
// expects, so `patties add @shadcn/<name>` stamps files that build unchanged.
//   - tsconfig `paths`: `@/*` → the app dir (`@/components/ui/button`, …)
//   - `@/lib/utils`: re-export of the catalog's `cn` helper

const ALIAS = "@/*";

interface TsConfig {
	compilerOptions?: { paths?: Record<string, string[]> };
	[key: string]: unknown;
}

export async function applyShadcnInit(
	uiPaths: UiPaths,
	opts: { dryRun: boolean; force: boolean },
): Promise<void> {
	await ensureAlias(uiPaths, opts);
	await ensureUtils(uiPaths, opts);
}

async function ensureAlias(
	uiPaths: UiPaths,
	opts: { dryRun: boolean },
): Promise<void> {
	const path = join(uiPaths.projectRoot, "tsconfig.json");
	const target = `./${relative(uiPaths.projectRoot, uiPaths.appDir) || "."}/*`;
	const file = Bun.file(path);
	const text = (await file.exists()) ? await file.text() : "{}";

	let config: TsConfig;
	let strictJson = true;
	try {
		config = JSON.parse(text) as TsConfig;
	} catch {
		strictJson = false;
		config = Bun.JSONC.parse(text) as TsConfig;
	}
	const existing = config.compilerOptions?.paths?.[ALIAS];
	if (existing) {
		log.dim(`  alias ${ALIAS} present (${existing.join(", ")})`);
		return;
	}
	// Rewriting would drop the user's comments; print the edit instead.
	if (!strictJson) {
		log.warn(
			`  tsconfig.json has comments; add "paths": { "${ALIAS}": ["${target}"] } to compilerOptions yourself.`,
		);
		return;
	}
	config.compilerOptions = {
		...(config.compilerOptions ?? {}),
		paths: { ...(config.compilerOptions?.paths ?? {}), [ALIAS]: [target] },
	};
	if (!opts.dryRun) {
		await Bun.write(path, `${JSON.stringify(config, null, "\t")}\n`);
	}
	log.success(`  alias ${ALIAS} -> ${target} (tsconfig.json)`);
}

async function ensureUtils(
	uiPaths: UiPaths,
	opts: { dryRun: boolean; force: boolean },
): Promise<void> {
	const path = join(uiPaths.appDir, "lib", "utils.ts");
	if ((await Bun.file(path).exists()) && !opts.force) {
		log.dim(`  ${path} present`);
		return;
	}
	const cnFile = join(uiPaths.internalDir, INTERNAL_FILES.cn);
	let spec = relative(dirname(path), cnFile).replace(/\\/g, "/");
	if (!spec.startsWith(".")) spec = `./${spec}`;
	if (!opts.dryRun) {
		await Bun.$`mkdir -p ${dirname(path)}`.quiet();
		await Bun.write(path, `export { cn } from ${JSON.stringify(spec)};\n`);
	}
	log.success(`  wrote ${path}`);
}
