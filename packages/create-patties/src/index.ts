import { existsSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

type AgentTemplate = "claude" | "codex" | "none";

interface Args {
	name?: string;
	template: AgentTemplate;
	target: "bun" | "edge";
	deploy: "cloudflare" | "vercel" | "deno" | "netlify" | "bun" | "none";
	install: boolean;
	git: boolean;
}

const TEMPLATES_ROOT = resolve(dirname(import.meta.dir), "templates");
const BASE_TEMPLATE = "default";
const VALID_TEMPLATES: AgentTemplate[] = ["claude", "codex", "none"];

export async function run(argv: string[]): Promise<number> {
	const args = parseArgs(argv);

	if (!args.name) {
		printUsage();
		return 2;
	}

	if (!isValidName(args.name)) {
		stderr(`✗ invalid project name: "${args.name}"`);
		return 2;
	}

	if (!VALID_TEMPLATES.includes(args.template)) {
		stderr(
			`✗ unknown --template "${args.template}" (expected: ${VALID_TEMPLATES.join(", ")})`,
		);
		return 2;
	}

	const targetDir = isAbsolute(args.name)
		? args.name
		: resolve(process.cwd(), args.name);

	if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
		stderr(`✗ directory not empty: ${targetDir}`);
		return 2;
	}

	const baseDir = resolve(TEMPLATES_ROOT, BASE_TEMPLATE);
	if (!existsSync(baseDir)) {
		stderr(`✗ base template missing: ${baseDir}`);
		return 1;
	}

	await Bun.$`mkdir -p ${targetDir}`.quiet();
	await Bun.$`cp -R ${baseDir}/. ${targetDir}`.quiet();

	await renameTemplateFiles(targetDir);
	await writePackageJson(targetDir, args.name);
	await patchPattiesConfig(targetDir, args);

	if (args.template !== "none") {
		const overlay = resolve(TEMPLATES_ROOT, `_${args.template}`);
		if (existsSync(overlay)) {
			await Bun.$`cp -R ${overlay}/. ${targetDir}`.quiet();
		}
	}

	if (args.install) {
		await Bun.$`bun install`.cwd(targetDir).quiet().nothrow();
	}

	if (args.git) {
		await Bun.$`git init`.cwd(targetDir).quiet().nothrow();
		await Bun.$`git add -A`.cwd(targetDir).quiet().nothrow();
		await Bun.$`git commit -m ${"chore: initial commit from create-patties"}`
			.cwd(targetDir)
			.quiet()
			.nothrow();
	}

	process.stdout.write(
		`\n✓ created ${args.name}\n\n  cd ${args.name}\n  bun dev\n`,
	);
	if (args.template === "claude") {
		process.stdout.write(
			"\nClaude Code is configured (CLAUDE.md). Run `claude` in the project to start a session.\n",
		);
	} else if (args.template === "codex") {
		process.stdout.write(
			"\nCodex is configured (AGENTS.md). Run `codex` in the project to start a session.\n",
		);
	}
	return 0;
}

function parseArgs(argv: string[]): Args {
	const out: Args = {
		template: "claude",
		target: "bun",
		deploy: "none",
		install: true,
		git: true,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--template") out.template = next(argv, ++i) as AgentTemplate;
		else if (a.startsWith("--template="))
			out.template = a.slice(11) as AgentTemplate;
		else if (a === "--target") out.target = next(argv, ++i) as Args["target"];
		else if (a.startsWith("--target="))
			out.target = a.slice(9) as Args["target"];
		else if (a === "--deploy") out.deploy = next(argv, ++i) as Args["deploy"];
		else if (a.startsWith("--deploy="))
			out.deploy = a.slice(9) as Args["deploy"];
		else if (a === "--no-install") out.install = false;
		else if (a === "--no-git") out.git = false;
		else if (!out.name && !a.startsWith("-")) out.name = a;
	}
	return out;
}

function next(argv: string[], i: number): string {
	return argv[i] ?? "";
}

function isValidName(name: string): boolean {
	if (!name) return false;
	if (name.includes("/") || name.includes("\\")) return false;
	if (name.startsWith(".")) return false;
	return /^[a-z0-9][a-z0-9_-]*$/.test(name);
}

async function renameTemplateFiles(dir: string): Promise<void> {
	const renames: Array<[string, string]> = [
		["gitignore", ".gitignore"],
		["README-template.md", "README.md"],
	];
	for (const [from, to] of renames) {
		const src = `${dir}/${from}`;
		if (await Bun.file(src).exists()) {
			await Bun.$`mv ${src} ${dir}/${to}`.quiet();
		}
	}
}

async function writePackageJson(dir: string, name: string): Promise<void> {
	const pkg = {
		name,
		version: "0.1.0",
		private: true,
		type: "module",
		scripts: {
			dev: "patties dev",
			build: "patties build",
			start: "patties start",
		},
		dependencies: sorted({
			patties: "latest",
			react: "^19.0.0",
			"react-dom": "^19.0.0",
		}),
		devDependencies: sorted({
			"@types/react": "^19.0.0",
			"@types/react-dom": "^19.0.0",
			"bun-types": "latest",
			typescript: "^5.5.0",
		}),
	};
	await Bun.write(`${dir}/package.json`, `${JSON.stringify(pkg, null, 2)}\n`);
}

function sorted(deps: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const k of Object.keys(deps).sort()) out[k] = deps[k] as string;
	return out;
}

async function patchPattiesConfig(dir: string, args: Args): Promise<void> {
	const path = `${dir}/patties.config.ts`;
	if (!(await Bun.file(path).exists())) return;
	const current = await Bun.file(path).text();
	const next = current.replace(
		/target:\s*"(bun|edge)"/,
		`target: "${args.target}"`,
	);
	if (next !== current) await Bun.write(path, next);
}

function stderr(msg: string): void {
	process.stderr.write(`${msg}\n`);
}

function printUsage(): void {
	process.stdout.write(`create-patties — scaffold a new Patties project

Usage:
  bunx create-patties@latest <name> [options]

Options:
  --template <claude|codex|none>    Agent platform (default: claude)
  --target   <bun|edge>             Runtime target (default: bun)
  --deploy   <cloudflare|vercel|deno|netlify|bun|none>
  --no-install                      Skip 'bun install'
  --no-git                          Skip 'git init'

Examples:
  bunx create-patties@latest my-app
  bunx create-patties@latest my-app --template codex
  bunx create-patties@latest my-app --template none --no-git
`);
}
