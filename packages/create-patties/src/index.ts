import { existsSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

interface Args {
	name?: string;
	template: "default" | "with-islands" | "ai-starter";
	target: "bun" | "edge";
	deploy: "cloudflare" | "vercel" | "deno" | "netlify" | "bun" | "none";
	agent: "claude-code" | "none";
	install: boolean;
	git: boolean;
}

const TEMPLATES_ROOT = resolve(dirname(import.meta.dir), "templates");

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

	const targetDir = isAbsolute(args.name)
		? args.name
		: resolve(process.cwd(), args.name);

	if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
		stderr(`✗ directory not empty: ${targetDir}`);
		return 2;
	}

	const templateDir = resolve(TEMPLATES_ROOT, args.template);
	if (!existsSync(templateDir)) {
		stderr(`✗ template not found: ${args.template}`);
		return 2;
	}

	await Bun.$`mkdir -p ${targetDir}`.quiet();
	await Bun.$`cp -R ${templateDir}/. ${targetDir}`.quiet();

	await patchPackageJson(targetDir, args.name);
	await patchPattiesConfig(targetDir, args);

	if (args.agent === "claude-code") {
		const claudeDir = resolve(TEMPLATES_ROOT, "_claude-code");
		if (existsSync(claudeDir)) {
			await Bun.$`cp -R ${claudeDir}/. ${targetDir}`.quiet();
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
	if (args.agent === "claude-code") {
		process.stdout.write(
			"\nClaude Code is configured. Open the project and run `claude` to start a session.\n",
		);
	}
	return 0;
}

function parseArgs(argv: string[]): Args {
	const out: Args = {
		template: "default",
		target: "bun",
		deploy: "none",
		agent: "none",
		install: true,
		git: true,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--template") out.template = next(argv, ++i) as Args["template"];
		else if (a.startsWith("--template="))
			out.template = a.slice(11) as Args["template"];
		else if (a === "--target") out.target = next(argv, ++i) as Args["target"];
		else if (a.startsWith("--target="))
			out.target = a.slice(9) as Args["target"];
		else if (a === "--deploy") out.deploy = next(argv, ++i) as Args["deploy"];
		else if (a.startsWith("--deploy="))
			out.deploy = a.slice(9) as Args["deploy"];
		else if (a === "--agent") out.agent = next(argv, ++i) as Args["agent"];
		else if (a.startsWith("--agent=")) out.agent = a.slice(8) as Args["agent"];
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

async function patchPackageJson(dir: string, name: string): Promise<void> {
	const path = `${dir}/package.json`;
	if (!(await Bun.file(path).exists())) return;
	const pkg = (await Bun.file(path).json()) as { name?: string };
	pkg.name = name;
	await Bun.write(path, `${JSON.stringify(pkg, null, 2)}\n`);
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
  bunx create-patties <name> [--template default|with-islands|ai-starter]
                            [--target bun|edge]
                            [--deploy cloudflare|vercel|deno|netlify|bun|none]
                            [--agent claude-code|none]
                            [--no-install] [--no-git]
`);
}
