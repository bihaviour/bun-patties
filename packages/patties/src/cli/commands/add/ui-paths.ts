import { isAbsolute, resolve, sep } from "node:path";
import type { UiConfig } from "../../../config/schema.ts";

// Resolved, absolute destinations for the add pipeline. Replaces the three
// hard-coded paths that used to live in stamper/internal/tokens.
export interface UiPaths {
	componentsDir: string;
	internalDir: string;
	tokensFile: string;
}

const DEFAULT_COMPONENTS_DIR = "app/components/ui";
const DEFAULT_TOKENS_FILE = "app/styles/tokens.css";
const INTERNAL_SUBDIR = "_internal";

// Thrown when a configured/passed path is absolute or escapes the project root.
// Callers map this to EXIT.USAGE with a one-line message.
export class UiPathError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UiPathError";
	}
}

// Reject absolute paths and any path that resolves outside `cwd`. Returns the
// resolved absolute path on success.
export function assertInsideProject(cwd: string, rel: string): string {
	if (isAbsolute(rel)) {
		throw new UiPathError(`path must be relative to the project root: ${rel}`);
	}
	const abs = resolve(cwd, rel);
	if (abs !== cwd && !abs.startsWith(cwd + sep)) {
		throw new UiPathError(`path escapes the project root: ${rel}`);
	}
	return abs;
}

// Resolve effective UI paths. Precedence (first wins):
//   componentsDir: --path > config.ui.componentsDir > convention
//   internalDir:   <--path>/_internal > config.ui.internalDir > <componentsDir>/_internal
//   tokensFile:    config.ui.tokensFile > convention   (never affected by --path)
export function resolveUiPaths(args: {
	cwd: string;
	ui?: Partial<UiConfig>;
	pathOverride?: string;
}): UiPaths {
	const { cwd, ui, pathOverride } = args;

	const componentsRel =
		pathOverride ?? ui?.componentsDir ?? DEFAULT_COMPONENTS_DIR;
	const componentsDir = assertInsideProject(cwd, componentsRel);

	// --path retargets helpers alongside the components; otherwise honor an
	// explicit config.ui.internalDir, else co-locate under componentsDir.
	let internalDir: string;
	if (pathOverride !== undefined) {
		internalDir = resolve(componentsDir, INTERNAL_SUBDIR);
	} else if (ui?.internalDir !== undefined) {
		internalDir = assertInsideProject(cwd, ui.internalDir);
	} else {
		internalDir = resolve(componentsDir, INTERNAL_SUBDIR);
	}

	const tokensRel = ui?.tokensFile ?? DEFAULT_TOKENS_FILE;
	const tokensFile = assertInsideProject(cwd, tokensRel);

	return { componentsDir, internalDir, tokensFile };
}
