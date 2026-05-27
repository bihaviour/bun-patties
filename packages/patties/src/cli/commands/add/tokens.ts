import { dirname, join } from "node:path";
import { log } from "../../log.ts";
import { resolveTemplatesDir } from "./resolve-templates.ts";

const START = (group: string) => `/* @patties:tokens ${group} */`;
const END = (group: string) => `/* @patties:end ${group} */`;

export async function mergeTokens(
	groups: string[],
	cwd: string,
	opts: { dryRun: boolean },
): Promise<{ added: string[] }> {
	if (groups.length === 0) return { added: [] };
	const templates = await resolveTemplatesDir();
	const sourcePath = join(templates, "tokens.css");
	const source = await Bun.file(sourcePath).text();
	const target = join(cwd, "app", "styles", "tokens.css");
	const existing = (await Bun.file(target).exists())
		? await Bun.file(target).text()
		: "";
	let out = existing;
	const added: string[] = [];
	for (const group of groups) {
		if (existing.includes(START(group))) continue;
		const block = extractBlock(source, group);
		if (!block) {
			log.warn(`token group "${group}" not found in templates/tokens.css`);
			continue;
		}
		if (out.length > 0 && !out.endsWith("\n")) out += "\n";
		out += `${block}\n`;
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

function extractBlock(source: string, group: string): string | null {
	const start = source.indexOf(START(group));
	const end = source.indexOf(END(group));
	if (start === -1 || end === -1 || end < start) return null;
	return source.slice(start, end + END(group).length);
}
