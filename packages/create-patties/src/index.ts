import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { hasGit, probeTools } from "./probes.ts";
import {
	type AgentTemplate,
	isInteractive,
	promptAgent,
	promptDeploy,
	promptName,
	promptScaffold,
	promptTarget,
} from "./prompts.ts";
import { renderTemplatesInTree } from "./readme.ts";

// Step logger — visible progress so the user can see what scaffolding does.
// Honors NO_COLOR; degrades gracefully on non-TTY streams.
function colorOn(): boolean {
	if (process.env.NO_COLOR) return false;
	return Boolean((process.stdout as NodeJS.WriteStream).isTTY);
}
const COL = colorOn();
const c = {
	dim: (s: string) => (COL ? `\x1b[2m${s}\x1b[0m` : s),
	green: (s: string) => (COL ? `\x1b[32m${s}\x1b[0m` : s),
	cyan: (s: string) => (COL ? `\x1b[36m${s}\x1b[0m` : s),
	bold: (s: string) => (COL ? `\x1b[1m${s}\x1b[0m` : s),
};
function step(msg: string): void {
	process.stdout.write(`  ${c.green("✓")} ${msg}\n`);
}
function pending(msg: string): void {
	process.stdout.write(`  ${c.dim("…")} ${msg}\n`);
}
function header(msg: string): void {
	process.stdout.write(`\n${c.bold(c.cyan("▲"))} ${msg}\n\n`);
}
function fmtMs(ms: number): string {
	return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

interface Args {
	name?: string;
	template: AgentTemplate;
	templateExplicit: boolean;
	target: "bun" | "edge";
	targetExplicit: boolean;
	deploy: "cloudflare" | "vercel" | "deno" | "netlify" | "bun" | "none";
	deployExplicit: boolean;
	install: boolean;
	git: boolean;
	yes: boolean;
	scaffold: "demo" | "blank";
	scaffoldExplicit: boolean;
}

const TEMPLATES_ROOT = resolve(dirname(import.meta.dir), "templates");
const BASE_TEMPLATE = "default";
const VALID_TEMPLATES: AgentTemplate[] = ["claude", "codex", "none"];

export async function run(argv: string[]): Promise<number> {
	const args = parseArgs(argv);
	const interactive = !args.yes && isInteractive();

	if (!args.name) {
		if (interactive) {
			args.name = promptName(undefined, isValidName);
			if (!args.name) {
				stderr("✗ failed to read a valid project name");
				return 2;
			}
		} else {
			printUsage();
			return 2;
		}
	}

	if (!isValidName(args.name)) {
		stderr(`✗ invalid project name: "${args.name}"`);
		return 2;
	}

	if (interactive) {
		if (!args.templateExplicit) args.template = promptAgent();
		if (!args.scaffoldExplicit) args.scaffold = promptScaffold();
		if (!args.targetExplicit) args.target = promptTarget();
		if (args.target === "edge" && !args.deployExplicit) {
			args.deploy = promptDeploy();
		}
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

	probeTools();

	header(`create-patties — scaffolding ${c.bold(args.name)}`);

	await Bun.$`mkdir -p ${targetDir}`.quiet();
	step(`created directory ${c.dim(targetDir)}`);

	await Bun.$`cp -R ${baseDir}/. ${targetDir}`.quiet();
	step(`copied base template ${c.dim("(default)")}`);

	await renameTemplateFiles(targetDir);
	await writePackageJson(targetDir, args.name);
	step(`wrote package.json ${c.dim(`(name: ${args.name})`)}`);
	await patchPattiesConfig(targetDir, args);
	step(`patched patties.config.ts ${c.dim(`(target: ${args.target})`)}`);

	if (args.template !== "none") {
		const overlay = resolve(TEMPLATES_ROOT, `_${args.template}`);
		if (existsSync(overlay)) {
			await Bun.$`cp -R ${overlay}/. ${targetDir}`.quiet();
			step(`applied agent overlay ${c.dim(`(${args.template})`)}`);
		}
	}

	if (args.scaffold === "blank") {
		await applyBlankScaffold(targetDir);
		step("applied blank scaffold (no demo)");
	} else {
		step("included interactive todo demo");
	}

	await renderTemplatesInTree(targetDir, {
		name: args.name,
		agent: args.template,
		target: args.target,
		deploy: args.deploy,
		scaffold: args.scaffold,
	});
	const manifestName =
		args.template === "codex"
			? "AGENTS.md"
			: args.template === "claude"
				? "CLAUDE.md"
				: "manifest";
	step(`rendered template variables (README, ${manifestName}, …)`);

	if (args.install) {
		pending("installing dependencies (bun install)…");
		const t0 = performance.now();
		const proc = await Bun.$`bun install`.cwd(targetDir).quiet().nothrow();
		const dt = performance.now() - t0;
		if (proc.exitCode === 0) {
			step(`installed dependencies ${c.dim(`(${fmtMs(dt)})`)}`);
		} else {
			step(
				`bun install exited with code ${proc.exitCode} — you may need to retry it manually`,
			);
		}
	} else {
		step(`skipped ${c.dim("`bun install`")} (--no-install)`);
	}

	let gitSkippedReason: string | undefined;
	if (args.git) {
		if (hasGit()) {
			// Strip git hook env vars so these commands resolve relative to targetDir
			// rather than inheriting GIT_DIR/GIT_INDEX_FILE from a running commit hook.
			const gitEnv: NodeJS.ProcessEnv = { ...process.env };
			for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) {
				delete gitEnv[key];
			}
			const init = await Bun.$`git init`
				.cwd(targetDir)
				.env(gitEnv)
				.quiet()
				.nothrow();
			// Only stage/commit once `targetDir` is itself the git top-level. If
			// `git init` failed, or the scaffold landed inside an existing repo (e.g.
			// a git worktree), git resolves `.git` to a parent and `git add`/`commit`
			// would clobber that outer repo. Compare the resolved top-level to be sure.
			const top = await Bun.$`git rev-parse --show-toplevel`
				.cwd(targetDir)
				.env(gitEnv)
				.quiet()
				.nothrow();
			// `git rev-parse` reports a symlink-resolved path; resolve `targetDir` the
			// same way so the comparison holds on macOS (/var → /private/var).
			const ownsRepo =
				init.exitCode === 0 &&
				top.exitCode === 0 &&
				top.stdout.toString().trim() === realpathSync(targetDir);
			if (ownsRepo) {
				await Bun.$`git add -A`.cwd(targetDir).env(gitEnv).quiet().nothrow();
				await Bun.$`git commit -m ${"chore: initial commit from create-patties"}`
					.cwd(targetDir)
					.env(gitEnv)
					.quiet()
					.nothrow();
				step("initialized git and committed");
			} else {
				gitSkippedReason = "git-init-failed";
			}
		} else {
			gitSkippedReason = "git-missing";
		}
	}

	const nextSteps = args.git
		? `\n  cd ${args.name}\n  bunx patties dev\n`
		: `\n  cd ${args.name}\n  bunx patties dev\n\n  # when you're ready to track this in git:\n  git init && git add -A && git commit -m "initial commit"\n`;
	process.stdout.write(`\n✓ created ${args.name}\n${nextSteps}`);
	if (gitSkippedReason === "git-missing") {
		stderr("create-patties: `git` not found — skipping `git init`.");
	}
	if (gitSkippedReason === "git-init-failed") {
		stderr("create-patties: `git init` failed — skipping the initial commit.");
	}
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
		templateExplicit: false,
		target: "bun",
		targetExplicit: false,
		deploy: "none",
		deployExplicit: false,
		install: true,
		git: false,
		yes: false,
		scaffold: "demo",
		scaffoldExplicit: false,
	};
	const setTemplate = (raw: string) => {
		out.template = aliasTemplate(raw);
		out.templateExplicit = true;
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--template") setTemplate(next(argv, ++i));
		else if (a.startsWith("--template=")) setTemplate(a.slice(11));
		// --agent: spec-05 alias kept for backwards compatibility.
		else if (a === "--agent") setTemplate(next(argv, ++i));
		else if (a.startsWith("--agent=")) setTemplate(a.slice(8));
		else if (a === "--target") {
			out.target = next(argv, ++i) as Args["target"];
			out.targetExplicit = true;
		} else if (a.startsWith("--target=")) {
			out.target = a.slice(9) as Args["target"];
			out.targetExplicit = true;
		} else if (a === "--deploy") {
			out.deploy = next(argv, ++i) as Args["deploy"];
			out.deployExplicit = true;
		} else if (a.startsWith("--deploy=")) {
			out.deploy = a.slice(9) as Args["deploy"];
			out.deployExplicit = true;
		} else if (a === "--no-install") out.install = false;
		else if (a === "--git") out.git = true;
		// --no-git: kept as a no-op for back-compat. Git is now opt-in
		// (default off) so most users don't need either flag.
		else if (a === "--no-git") out.git = false;
		else if (a === "--yes" || a === "-y") out.yes = true;
		else if (a === "--blank" || a === "--empty") {
			out.scaffold = "blank";
			out.scaffoldExplicit = true;
		} else if (a === "--demo") {
			out.scaffold = "demo";
			out.scaffoldExplicit = true;
		} else if (!out.name && !a.startsWith("-")) out.name = a;
	}
	return out;
}

// Translate spec-05 --agent values (claude-code/none) and current --template
// values (claude/codex/none) into the unified AgentTemplate type.
function aliasTemplate(raw: string): AgentTemplate {
	if (raw === "claude-code") return "claude";
	if (raw === "claude" || raw === "codex" || raw === "none") return raw;
	return raw as AgentTemplate;
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

// --blank scaffold: drop the interactive demo and ship a single hello page.
// We start from the same default template and prune so we keep exactly one
// source-of-truth for things like patties.config.ts / tsconfig.json.
async function applyBlankScaffold(dir: string): Promise<void> {
	await Bun.$`rm -rf ${dir}/app/islands`.quiet();
	await Bun.write(
		`${dir}/app/routes/index.tsx`,
		`export default function Index(): JSX.Element {
	return (
		<main>
			<h1>Hello from {{name}}</h1>
			<p>
				This page is server-rendered by Patties. Add more files under{" "}
				<code>app/routes/</code> to grow your app.
			</p>
		</main>
	);
}
`,
	);
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
		engines: { bun: ">=1.3.0" },
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
	let next = current.replace(
		/target:\s*"(bun|edge)"/,
		`target: "${args.target}"`,
	);
	// Point the agent manifest at the file the chosen agent already reads.
	// Default (claude / none) leaves the framework default ("CLAUDE.md").
	if (args.template === "codex" && !/agentsMd:/.test(next)) {
		next = next.replace(
			/target:\s*"(bun|edge)",?\n/,
			(m) => `${m.replace(/,?\n$/, ",\n")}\tagentsMd: { path: "AGENTS.md" },\n`,
		);
	}
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
  --git                             Run 'git init' + initial commit (opt-in)
  --yes, -y                         Accept all defaults, skip prompts
  --blank, --empty                  Scaffold a hello-world page only (no demo)
  --demo                            Scaffold the interactive todo demo (default)

Examples:
  bunx create-patties@latest my-app
  bunx create-patties@latest my-app --template codex
  bunx create-patties@latest my-app --template none
  bunx create-patties@latest my-app --git           # opt-in git init
`);
}
