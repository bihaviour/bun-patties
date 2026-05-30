import { dirname, join } from "node:path";
import { log } from "../../log.ts";
import type { UiPaths } from "./ui-paths.ts";

const START = (group: string) => `/* @patties:tokens ${group} */`;
const END = (group: string) => `/* @patties:end ${group} */`;

// Resolve the token CSS to read from. A named theme reads the preset payload
// under templates/themes/<name>/tokens.css; absent, the default token set.
function tokenSourcePath(templatesDir: string, themeName?: string): string {
	return themeName
		? join(templatesDir, "themes", themeName, "tokens.css")
		: join(templatesDir, "tokens.css");
}

// True if a named base-color preset ships in the catalog.
export function themeExists(
	templatesDir: string,
	themeName: string,
): Promise<boolean> {
	return Bun.file(tokenSourcePath(templatesDir, themeName)).exists();
}

export async function mergeTokens(
	groups: string[],
	uiPaths: UiPaths,
	templatesDir: string,
	opts: { dryRun: boolean; themeName?: string; force?: boolean },
): Promise<{ added: string[] }> {
	if (groups.length === 0) return { added: [] };
	const sourcePath = tokenSourcePath(templatesDir, opts.themeName);
	if (!(await Bun.file(sourcePath).exists())) {
		throw new Error(`unknown theme preset: ${opts.themeName}`);
	}
	const source = await Bun.file(sourcePath).text();
	const target = uiPaths.tokensFile;
	const existing = (await Bun.file(target).exists())
		? await Bun.file(target).text()
		: "";
	let out = existing;
	const added: string[] = [];
	for (const group of groups) {
		const block = extractBlock(source, group);
		if (!block) {
			log.warn(`token group "${group}" not found in templates/tokens.css`);
			continue;
		}
		const present = out.includes(START(group));
		if (present && !opts.force) continue;
		if (present) {
			out = replaceBlock(out, group, block);
		} else {
			if (out.length > 0 && !out.endsWith("\n")) out += "\n";
			out += `${block}\n`;
		}
		added.push(group);
	}
	if (added.length === 0) return { added: [] };
	if (!opts.dryRun) {
		await Bun.$`mkdir -p ${dirname(target)}`.quiet();
		await Bun.write(target, out);
	}
	for (const g of added) log.success(`  tokens: +${g} -> ${target}`);
	return { added };
}

export function extractBlock(source: string, group: string): string | null {
	const start = source.indexOf(START(group));
	const end = source.indexOf(END(group));
	if (start === -1 || end === -1 || end < start) return null;
	return source.slice(start, end + END(group).length);
}

// Replace an existing fenced group block in `target` with `block`, preserving
// everything outside the START…END markers. Used by --force re-merges.
function replaceBlock(target: string, group: string, block: string): string {
	const start = target.indexOf(START(group));
	const end = target.indexOf(END(group));
	if (start === -1 || end === -1 || end < start) return target;
	return target.slice(0, start) + block + target.slice(end + END(group).length);
}
