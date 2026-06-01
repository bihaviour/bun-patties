import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { hasGit, probeTools } from "./probes.ts";
import {
	type AgentTemplate,
	type Deploy,
	isInteractive,
	type ProjectType,
	promptAgent,
	promptDeploy,
	promptMonorepo,
	promptName,
	promptTarget,
	promptType,
	promptUi,
	type Target,
	type Theme,
} from "./prompts.ts";
import { renderTemplatesInTree } from "./readme.ts";
import { applyUiStarter, UI_DEPS, UI_DEV_DEPS } from "./ui.ts";

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
	type: ProjectType;
	typeExplicit: boolean;
	ui: boolean;
	uiExplicit: boolean;
	monorepo: boolean;
	monorepoExplicit: boolean;
	target: Target;
	targetExplicit: boolean;
	theme: Theme;
	deploy: Deploy;
	deployExplicit: boolean;
	install: boolean;
	git: boolean;
	yes: boolean;
}

const TEMPLATES_ROOT = resolve(dirname(import.meta.dir), "templates");
const BASE_TEMPLATE = "default";
const VALID_TEMPLATES: AgentTemplate[] = ["claude", "codex", "none"];
const VALID_TYPES: ProjectType[] = ["frontend", "backend", "fullstack"];
const VALID_THEMES: Theme[] = ["neutral", "slate", "stone", "zinc"];

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
		if (!args.typeExplicit) args.type = promptType();
		if (
			(args.type === "frontend" || args.type === "fullstack") &&
			!args.uiExplicit
		) {
			args.ui = promptUi();
		}
		if (args.type === "fullstack" && !args.monorepoExplicit) {
			args.monorepo = promptMonorepo();
		}
		if (!args.targetExplicit) args.target = promptTarget(args.type);
		if (args.target === "edge" && !args.deployExplicit) {
			args.deploy = promptDeploy();
		}
	}

	if (!VALID_TEMPLATES.includes(args.template)) {
		stderr(
			`✗ unknown --agent "${args.template}" (expected: ${VALID_TEMPLATES.join(", ")})`,
		);
		return 2;
	}
	if (!VALID_TYPES.includes(args.type)) {
		stderr(
			`✗ unknown --type "${args.type}" (expected: ${VALID_TYPES.join(", ")})`,
		);
		return 2;
	}

	// Gating (spec 18 §Behavior): backend has no UI surface; only full-stack
	// projects can be a monorepo or use the container target.
	if (args.type === "backend") args.ui = false;
	if (args.type !== "fullstack") {
		args.monorepo = false;
		if (args.target === "container") {
			stderr("✗ --target container is only available for --type fullstack");
			return 2;
		}
	}

	const appName = args.name;
	const targetDir = isAbsolute(args.name)
		? args.name
		: resolve(process.cwd(), args.name);
	const appRoot = args.monorepo ? `${targetDir}/apps/${appName}` : targetDir;

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

	await Bun.$`mkdir -p ${appRoot}`.quiet();
	await Bun.$`cp -R ${baseDir}/. ${appRoot}`.quiet();
	step(`copied base template ${c.dim(`(${args.type})`)}`);

	// README + .gitignore live at the project root; in a monorepo that's above
	// the app dir, so lift them out before renaming.
	if (args.monorepo) {
		for (const f of ["README-template.md", "gitignore"]) {
			if (existsSync(`${appRoot}/${f}`)) {
				await Bun.$`mv ${appRoot}/${f} ${targetDir}/${f}`.quiet();
			}
		}
	}
	await renameTemplateFiles(targetDir);

	await applyProjectType(appRoot, args.type);
	step(`applied project type ${c.dim(`(${args.type})`)}`);

	await writeAppPackageJson(appRoot, appName, args);
	await patchPattiesConfig(appRoot, args);
	step(
		`wrote package.json + patties.config.ts ${c.dim(`(target: ${args.target})`)}`,
	);

	if (args.template !== "none") {
		const overlay = resolve(TEMPLATES_ROOT, `_${args.template}`);
		if (existsSync(overlay)) {
			await Bun.$`cp -R ${overlay}/. ${targetDir}`.quiet();
			step(`applied agent overlay ${c.dim(`(${args.template})`)}`);
		}
	}

	if (args.monorepo) {
		await setupMonorepoRoot(targetDir, appName);
		step(`set up Bun workspace ${c.dim(`(apps/${appName})`)}`);
	}

	if (args.ui) {
		await applyUiStarter(
			appRoot,
			args.theme,
			resolve(TEMPLATES_ROOT, "ui-starter"),
		);
		step(`stamped Patties UI starter ${c.dim(`(theme: ${args.theme})`)}`);
	}

	if (args.target === "container") {
		await applyContainer(appRoot, args.name);
		step("emitted Dockerfile + .dockerignore");
	}

	await renderTemplatesInTree(targetDir, {
		name: args.name,
		agent: args.template,
		type: args.type,
		ui: args.ui ? "yes" : "no",
		monorepo: args.monorepo ? "yes" : "no",
		target: args.target,
		deploy: args.deploy,
		app_name: appName,
	});
	step("rendered template variables (README, app files, …)");

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

	const gitSkippedReason = args.git ? await initGit(targetDir) : undefined;
	if (args.git && !gitSkippedReason) step("initialized git and committed");

	printNextSteps(args, appName);
	if (gitSkippedReason === "git-missing") {
		stderr("create-patties: `git` not found — skipping `git init`.");
	}
	if (gitSkippedReason === "git-init-failed") {
		stderr("create-patties: `git init` failed — skipping the initial commit.");
	}
	return 0;
}

function parseArgs(argv: string[]): Args {
	const out: Args = {
		template: "claude",
		templateExplicit: false,
		type: "fullstack",
		typeExplicit: false,
		ui: true,
		uiExplicit: false,
		monorepo: false,
		monorepoExplicit: false,
		target: "bun",
		targetExplicit: false,
		theme: "neutral",
		deploy: "none",
		deployExplicit: false,
		install: true,
		git: false,
		yes: false,
	};
	const setTemplate = (raw: string) => {
		out.template = aliasTemplate(raw);
		out.templateExplicit = true;
	};
	const setType = (raw: string) => {
		out.type = raw as ProjectType;
		out.typeExplicit = true;
	};
	const setTarget = (raw: string) => {
		out.target = raw as Target;
		out.targetExplicit = true;
	};
	const setDeploy = (raw: string) => {
		out.deploy = raw as Deploy;
		out.deployExplicit = true;
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		// --agent is the spec-18 name; --template is the spec-05/09 alias.
		if (a === "--template" || a === "--agent") setTemplate(next(argv, ++i));
		else if (a.startsWith("--template=")) setTemplate(a.slice(11));
		else if (a.startsWith("--agent=")) setTemplate(a.slice(8));
		else if (a === "--type") setType(next(argv, ++i));
		else if (a.startsWith("--type=")) setType(a.slice(7));
		else if (a === "--ui") {
			out.ui = true;
			out.uiExplicit = true;
		} else if (a === "--no-ui") {
			out.ui = false;
			out.uiExplicit = true;
		} else if (a === "--monorepo") {
			out.monorepo = true;
			out.monorepoExplicit = true;
		} else if (a === "--no-monorepo") {
			out.monorepo = false;
			out.monorepoExplicit = true;
		} else if (a === "--target") setTarget(next(argv, ++i));
		else if (a.startsWith("--target=")) setTarget(a.slice(9));
		else if (a === "--theme") out.theme = aliasTheme(next(argv, ++i));
		else if (a.startsWith("--theme=")) out.theme = aliasTheme(a.slice(8));
		else if (a === "--deploy") setDeploy(next(argv, ++i));
		else if (a.startsWith("--deploy=")) setDeploy(a.slice(9));
		else if (a === "--no-install") out.install = false;
		else if (a === "--git") out.git = true;
		// --no-git: kept as a no-op for back-compat. Git is opt-in (default off).
		else if (a === "--no-git") out.git = false;
		else if (a === "--yes" || a === "-y") out.yes = true;
		// --blank / --demo: spec-09 scaffold flags, superseded by --type. Accepted
		// as no-ops so old invocations don't error.
		else if (a === "--blank" || a === "--empty" || a === "--demo") continue;
		else if (!out.name && !a.startsWith("-")) out.name = a;
	}
	return out;
}

// Translate spec-05 --agent values (claude-code/none) and current --agent
// values (claude/codex/none) into the unified AgentTemplate type.
function aliasTemplate(raw: string): AgentTemplate {
	if (raw === "claude-code") return "claude";
	if (raw === "claude" || raw === "codex" || raw === "none") return raw;
	return raw as AgentTemplate;
}

function aliasTheme(raw: string): Theme {
	return (VALID_THEMES as string[]).includes(raw) ? (raw as Theme) : "neutral";
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

// Shape the base (full-stack) template for the chosen project type. We prune
// from one source rather than keep three near-identical trees.
async function applyProjectType(
	appRoot: string,
	type: ProjectType,
): Promise<void> {
	if (type === "frontend") {
		// No API surface.
		await Bun.$`rm -rf ${appRoot}/app/routes/api`.quiet();
	} else if (type === "backend") {
		// API only — drop the page + island, add a sample resource.
		await Bun.$`rm -rf ${appRoot}/app/islands`.quiet();
		await Bun.$`rm -f ${appRoot}/app/routes/index.tsx`.quiet();
		const overlay = resolve(TEMPLATES_ROOT, "_backend");
		if (existsSync(overlay)) {
			await Bun.$`cp -R ${overlay}/. ${appRoot}`.quiet();
		}
	}
}

function pkgScripts(ui: boolean): Record<string, string> {
	if (!ui) {
		return {
			dev: "patties dev",
			build: "patties build",
			start: "patties start",
			typecheck: "tsc --noEmit",
		};
	}
	// UI projects compile Tailwind themselves (Patties bundles no CSS). `css`
	// emits the sheet the styles route serves; `dev`/`build` run it first so the
	// app is styled on boot. `css:watch` rebuilds on className changes in dev.
	const css =
		"tailwindcss -i app/styles/app.css -o app/styles/app.generated.css";
	return {
		dev: "bun run css && patties dev",
		build: "bun run css && patties build",
		start: "patties start",
		typecheck: "tsc --noEmit",
		css,
		"css:watch": `${css} --watch`,
	};
}

async function writeAppPackageJson(
	dir: string,
	name: string,
	args: Args,
): Promise<void> {
	const dependencies: Record<string, string> = {
		patties: "latest",
		react: "^19.0.0",
		"react-dom": "^19.0.0",
	};
	const devDependencies: Record<string, string> = {
		"@types/react": "^19.0.0",
		"@types/react-dom": "^19.0.0",
		"bun-types": "latest",
		typescript: "^5.5.0",
	};
	if (args.ui) {
		Object.assign(dependencies, UI_DEPS);
		Object.assign(devDependencies, UI_DEV_DEPS);
	}
	const pkg = {
		name,
		version: "0.1.0",
		private: true,
		type: "module",
		scripts: pkgScripts(args.ui),
		dependencies: sorted(dependencies),
		devDependencies: sorted(devDependencies),
		engines: { bun: ">=1.3.0" },
	};
	await Bun.write(`${dir}/package.json`, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Root workspace manifest + skeleton (spec 18 §Monorepo layout).
async function setupMonorepoRoot(
	targetDir: string,
	appName: string,
): Promise<void> {
	const root = {
		name: `${appName}-monorepo`,
		version: "0.1.0",
		private: true,
		type: "module",
		workspaces: ["apps/*", "packages/*"],
		engines: { bun: ">=1.3.0" },
	};
	await Bun.write(
		`${targetDir}/package.json`,
		`${JSON.stringify(root, null, 2)}\n`,
	);
	// biome.json is written here rather than shipped as a template file: a
	// committed nested biome.json would be discovered as a conflicting root
	// config by this repo's own Biome.
	await Bun.write(`${targetDir}/biome.json`, `${MONOREPO_BIOME}\n`);
	const skeleton = resolve(TEMPLATES_ROOT, "_monorepo");
	if (existsSync(skeleton)) {
		await Bun.$`cp -R ${skeleton}/. ${targetDir}`.quiet();
	}
}

const MONOREPO_BIOME = JSON.stringify(
	{
		$schema: "https://biomejs.dev/schemas/2.4.15/schema.json",
		vcs: { enabled: true, clientKind: "git", useIgnoreFile: true },
		formatter: { enabled: true, indentStyle: "tab" },
		linter: { enabled: true, rules: { recommended: true } },
		javascript: { formatter: { quoteStyle: "double" } },
		assist: {
			enabled: true,
			actions: { source: { organizeImports: "on" } },
		},
	},
	null,
	2,
);

async function applyContainer(appRoot: string, name: string): Promise<void> {
	const overlay = resolve(TEMPLATES_ROOT, "_container");
	if (!existsSync(overlay)) return;
	await Bun.$`cp -R ${overlay}/. ${appRoot}`.quiet();
	// Dockerfile has no rendered extension, so interpolate {{name}} here.
	const dockerfile = `${appRoot}/Dockerfile`;
	if (await Bun.file(dockerfile).exists()) {
		const text = await Bun.file(dockerfile).text();
		await Bun.write(dockerfile, text.replaceAll("{{name}}", name));
	}
}

function sorted(deps: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const k of Object.keys(deps).sort()) out[k] = deps[k] as string;
	return out;
}

// container packages the bun adapter, so patties.config keeps target "bun".
function configTarget(target: Target): "bun" | "edge" {
	return target === "edge" ? "edge" : "bun";
}

async function patchPattiesConfig(dir: string, args: Args): Promise<void> {
	const path = `${dir}/patties.config.ts`;
	if (!(await Bun.file(path).exists())) return;
	const current = await Bun.file(path).text();
	let nextText = current.replace(
		/target:\s*"(bun|edge)"/,
		`target: "${configTarget(args.target)}"`,
	);
	// Point the agent manifest at the file the chosen agent already reads.
	// Default (claude / none) leaves the framework default ("CLAUDE.md").
	if (args.template === "codex" && !/agentsMd:/.test(nextText)) {
		nextText = nextText.replace(
			/target:\s*"(bun|edge)",?\n/,
			(m) => `${m.replace(/,?\n$/, ",\n")}\tagentsMd: { path: "AGENTS.md" },\n`,
		);
	}
	if (nextText !== current) await Bun.write(path, nextText);
}

async function initGit(targetDir: string): Promise<string | undefined> {
	if (!hasGit()) return "git-missing";
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
	if (!ownsRepo) return "git-init-failed";
	await Bun.$`git add -A`.cwd(targetDir).env(gitEnv).quiet().nothrow();
	await Bun.$`git commit -m ${"chore: initial commit from create-patties"}`
		.cwd(targetDir)
		.env(gitEnv)
		.quiet()
		.nothrow();
	return undefined;
}

function printNextSteps(args: Args, appName: string): void {
	const out = (s: string) => process.stdout.write(s);
	const devCmd = args.monorepo
		? `bun --filter ${appName} dev`
		: "bunx patties dev";
	out(`\n✓ created ${args.name}\n\n`);
	out(`  cd ${args.name}\n`);
	if (!args.install) out("  bun install\n");
	out(
		`  ${devCmd}            → http://localhost:3000  (start the dev server)\n`,
	);
	if (args.ui) {
		out("\nPatties UI is set up — components live in app/components/ui/.\n");
	}
	if (args.template === "claude") {
		out(
			"\nWant to scaffold features (auth, CRM, task board, dashboard, …)?\n" +
				"Open a NEW terminal in this project and run:\n\n" +
				'  claude --permission-mode plan "/patties-init"\n\n' +
				"That starts an interactive, plan-mode session that designs and\n" +
				"scaffolds your project with you before writing any files.\n",
		);
	} else if (args.template === "codex") {
		out(
			"\nWant to scaffold features (auth, CRM, task board, dashboard, …)?\n" +
				"Open Codex in this project and ask it to scaffold a pattern — it reads\n" +
				".codex/rules/patties-patterns.md for the recipes.\n",
		);
	} else {
		out(
			"\nAdd UI components with `patties add <component>`. Feature patterns are\n" +
				"agent-driven — re-scaffold with --agent claude or codex to get /patties.\n",
		);
	}
}

function stderr(msg: string): void {
	process.stderr.write(`${msg}\n`);
}

function printUsage(): void {
	process.stdout.write(`create-patties — scaffold a new Patties project

Usage:
  bunx create-patties@latest <name> [options]

Options:
  --agent      claude | codex | none                 (default claude)
  --type       frontend | backend | fullstack        (default fullstack)
  --ui | --no-ui                                      (frontend/fullstack; default yes)
  --monorepo | --no-monorepo                          (fullstack only; default no)
  --target     bun | edge | container                (container = fullstack only; default bun)
  --deploy     cloudflare | vercel | deno | netlify | none   (edge only)
  --theme      neutral | slate | stone | zinc         (ui only, default neutral)
  --yes, -y                                           (accept all defaults)
  --no-install                                        (skip 'bun install')
  --git                                               (run 'git init' + initial commit)

Examples:
  bunx create-patties@latest my-app
  bunx create-patties@latest my-app --type backend
  bunx create-patties@latest my-app --type fullstack --monorepo --ui --theme slate
  bunx create-patties@latest my-app --agent codex
  bunx create-patties@latest my-app --agent none
`);
}
