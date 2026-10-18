import { isAbsolute, resolve, sep } from "node:path";
import type { ComponentFile } from "patties-ui/types";
import type { UiConfig } from "../../../config/schema.ts";

// Resolved, absolute destinations for the add pipeline. Replaces the three
// hard-coded paths that used to live in stamper/internal/tokens.
export interface UiPaths {
	componentsDir: string;
	internalDir: string;
	tokensFile: string;
	// The `@/` alias root (config.appDir). Anchors `root: "app"` files.
	appDir: string;
	projectRoot: string;
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
	appDir?: string;
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

	// loadConfig already absolutizes config.appDir; a relative value comes from
	// callers passing the convention.
	const appRel = args.appDir ?? "app";
	const appDir = isAbsolute(appRel) ? appRel : assertInsideProject(cwd, appRel);

	return { componentsDir, internalDir, tokensFile, appDir, projectRoot: cwd };
}

// The directory a component file's `to` is relative to.
export function fileRootDir(uiPaths: UiPaths, file: ComponentFile): string {
	switch (file.root ?? "components") {
		case "components":
			return uiPaths.componentsDir;
		case "app":
			return uiPaths.appDir;
	}
}

// Subdirs of the app dir a registry file may land in (`root: "app"`).
export const APP_FILE_DIRS = ["components", "hooks", "lib"] as const;

// Throws unless an app-rooted file stays in APP_FILE_DIRS with no dot-segments,
// so an untrusted payload can't drop routes, middleware, or `.env`-style files.
export function assertAppFileAllowed(file: ComponentFile): void {
	if ((file.root ?? "components") !== "app") return;
	const segs = file.to.split("/");
	const top = segs[0] ?? "";
	if (
		segs.length < 2 ||
		!(APP_FILE_DIRS as readonly string[]).includes(top) ||
		segs.some((s) => s.startsWith("."))
	) {
		throw new Error(
			`refusing to stamp ${file.to} into the app dir: only ${APP_FILE_DIRS.map((d) => `${d}/`).join(", ")} are allowed`,
		);
	}
}

// Absolute stamp destination for a component file.
export function fileDest(uiPaths: UiPaths, file: ComponentFile): string {
	return resolve(fileRootDir(uiPaths, file), file.to);
}
