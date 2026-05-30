// README + template-file rendering. See spec cli/09-create-patties-dx item 2.
//
// `applyTemplate` does two passes:
//   1. Strip/keep conditional blocks delimited by:
//        <!-- if:KEY=VALUE -->...<!-- /if -->
//      The block is kept iff `vars[KEY] === VALUE`.
//   2. Replace `{{name}}`, `{{agent}}`, `{{target}}`, `{{deploy}}` placeholders
//      with the corresponding `vars` entry.
//
// `renderTemplatesInTree` walks a scaffolded project and applies the template
// to every text file we care about (README.md, *.md, *.json, *.ts, *.tsx).
// Anything else is left untouched so we don't corrupt binary assets.

export interface TemplateVars {
	name: string;
	agent: "claude" | "codex" | "none";
	target: "bun" | "edge";
	deploy: "cloudflare" | "vercel" | "deno" | "netlify" | "bun" | "none";
	scaffold: "demo" | "blank";
}

const CONDITIONAL_RE =
	/<!--\s*if:([a-zA-Z_]+)=([a-zA-Z0-9_-]+)\s*-->([\s\S]*?)<!--\s*\/if\s*-->\n?/g;

const TEXT_EXT_RE =
	/\.(md|mdx|json|jsonc|ts|tsx|js|jsx|sh|toml|yml|yaml|gitignore)$/;

export function applyTemplate(source: string, vars: TemplateVars): string {
	const stripped = source.replace(
		CONDITIONAL_RE,
		(_match, key: string, value: string, body: string) => {
			const v = (vars as unknown as Record<string, string>)[key];
			return v === value ? body : "";
		},
	);
	return (
		stripped
			.replaceAll("{{name}}", vars.name)
			.replaceAll("{{agent}}", vars.agent)
			.replaceAll("{{target}}", vars.target)
			.replaceAll("{{deploy}}", vars.deploy)
			.replaceAll("{{scaffold}}", vars.scaffold)
			// Legacy placeholders from earlier overlay revisions — kept so existing
			// CLAUDE.md / AGENTS.md template text keeps interpolating.
			.replaceAll("{{PROJECT_NAME}}", vars.name)
			.replaceAll("{{DEPLOY_TARGET}}", vars.deploy)
	);
}

export async function renderTemplatesInTree(
	dir: string,
	vars: TemplateVars,
): Promise<void> {
	const glob = new Bun.Glob("**/*");
	for await (const rel of glob.scan({ cwd: dir, onlyFiles: true, dot: true })) {
		if (!TEXT_EXT_RE.test(rel) && !rel.endsWith("README.md")) continue;
		const path = `${dir}/${rel}`;
		const file = Bun.file(path);
		const text = await file.text();
		if (!hasTemplateMarkers(text)) continue;
		await Bun.write(path, applyTemplate(text, vars));
	}
}

function hasTemplateMarkers(text: string): boolean {
	return text.includes("{{") || text.includes("<!-- if:");
}
