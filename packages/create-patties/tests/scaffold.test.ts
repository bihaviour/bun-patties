import { afterAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { run } from "../src/index.ts";

// Matrix tests for the spec-18 redesign (project type, Patties UI, monorepo,
// container) and spec-19 agent overlays. Runs offline with --no-install.

const created: string[] = [];
afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
});

async function mktemp(): Promise<string> {
	const d = (await Bun.$`mktemp -d -t patties-scaffold.XXXXXX`.text()).trim();
	created.push(d);
	return d;
}

// Scaffold `name` inside a fresh temp dir; returns the project dir + exit code.
async function scaffold(
	name: string,
	flags: string[],
): Promise<{ dir: string; code: number }> {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run([name, "--no-install", "--no-git", ...flags]);
		return { dir: `${root}/${name}`, code };
	} finally {
		process.chdir(prev);
	}
}

test("--type backend: API only, no islands or page, no UI", async () => {
	const { dir, code } = await scaffold("api", ["--type", "backend"]);
	expect(code).toBe(0);
	expect(existsSync(`${dir}/app/islands`)).toBe(false);
	expect(existsSync(`${dir}/app/routes/index.tsx`)).toBe(false);
	expect(existsSync(`${dir}/app/routes/api/health.ts`)).toBe(true);
	expect(existsSync(`${dir}/app/routes/api/todos.ts`)).toBe(true);
	// Backend is never offered UI.
	expect(existsSync(`${dir}/app/components/ui`)).toBe(false);
});

test("--type backend rejects --target container", async () => {
	const { code } = await scaffold("api2", [
		"--type",
		"backend",
		"--target",
		"container",
	]);
	expect(code).toBe(2);
});

test("--type frontend trims the API route, keeps the island", async () => {
	const { dir, code } = await scaffold("fe", ["--type", "frontend", "--no-ui"]);
	expect(code).toBe(0);
	expect(existsSync(`${dir}/app/islands/TodoApp.tsx`)).toBe(true);
	expect(existsSync(`${dir}/app/routes/api`)).toBe(false);
});

test("--type fullstack --monorepo builds a Bun workspace", async () => {
	const { dir, code } = await scaffold("shop", [
		"--type",
		"fullstack",
		"--monorepo",
		"--no-ui",
	]);
	expect(code).toBe(0);
	const root = (await Bun.file(`${dir}/package.json`).json()) as {
		workspaces?: string[];
	};
	expect(root.workspaces).toEqual(["apps/*", "packages/*"]);
	expect(existsSync(`${dir}/apps/shop/app/routes/index.tsx`)).toBe(true);
	expect(existsSync(`${dir}/apps/shop/patties.config.ts`)).toBe(true);
	expect(existsSync(`${dir}/packages/README.md`)).toBe(true);
	// Agent overlay sits at the workspace root, not inside the app.
	expect(existsSync(`${dir}/CLAUDE.md`)).toBe(true);
	expect(existsSync(`${dir}/apps/shop/CLAUDE.md`)).toBe(false);
	const app = (await Bun.file(`${dir}/apps/shop/package.json`).json()) as {
		name: string;
	};
	expect(app.name).toBe("shop");
});

test("--ui stamps the starter set + tokens + patties-ui dep, themed", async () => {
	const { dir, code } = await scaffold("ui1", [
		"--type",
		"fullstack",
		"--ui",
		"--theme",
		"slate",
	]);
	expect(code).toBe(0);
	for (const name of ["button", "card", "input", "label"]) {
		expect(existsSync(`${dir}/app/components/ui/${name}.tsx`)).toBe(true);
	}
	expect(existsSync(`${dir}/app/components/ui/_internal/cn.ts`)).toBe(true);
	expect(existsSync(`${dir}/app/styles/tokens.css`)).toBe(true);
	const pkg = (await Bun.file(`${dir}/package.json`).json()) as {
		devDependencies: Record<string, string>;
		dependencies: Record<string, string>;
		scripts: Record<string, string>;
	};
	expect(pkg.devDependencies["patties-ui"]).toBeDefined();
	expect(pkg.dependencies.clsx).toBeDefined();
	// slate theme carries its signature hue; neutral would be chroma 0.
	const tokens = await Bun.file(`${dir}/app/styles/tokens.css`).text();
	expect(tokens).toContain("264.695");
});

test("--ui wires the Tailwind compile + stylesheet serving", async () => {
	const { dir, code } = await scaffold("uicss", [
		"--type",
		"fullstack",
		"--ui",
	]);
	expect(code).toBe(0);
	// The shared head() + the route that serves the compiled sheet.
	expect(existsSync(`${dir}/app/components/_head.tsx`)).toBe(true);
	expect(existsSync(`${dir}/app/routes/api/styles.ts`)).toBe(true);
	// Placeholder so the route's `type: "text"` import resolves pre-compile.
	expect(existsSync(`${dir}/app/styles/app.generated.css`)).toBe(true);
	const pkg = (await Bun.file(`${dir}/package.json`).json()) as {
		devDependencies: Record<string, string>;
		scripts: Record<string, string>;
	};
	expect(pkg.devDependencies["@tailwindcss/cli"]).toBeDefined();
	expect(pkg.scripts.css).toContain("tailwindcss");
	// dev/build compile the sheet first so the app is styled on boot.
	expect(pkg.scripts.dev).toContain("bun run css");
	expect(pkg.scripts.build).toContain("bun run css");
	// The demo page opts into styling by re-exporting head.
	const index = await Bun.file(`${dir}/app/routes/index.tsx`).text();
	expect(index).toContain('export { head } from "../components/_head.tsx"');
	// Generated output is gitignored, not committed.
	const gitignore = await Bun.file(`${dir}/.gitignore`).text();
	expect(gitignore).toContain("app/styles/app.generated.css");
});

test("scaffold is shaped to typecheck cleanly (tsconfig + no global JSX)", async () => {
	const { dir, code } = await scaffold("tsok", ["--yes"]);
	expect(code).toBe(0);
	const tsconfig = (await Bun.file(`${dir}/tsconfig.json`).json()) as {
		compilerOptions: Record<string, unknown>;
	};
	// Sources import with .ts/.tsx extensions (Bun resolution) — tsc needs these
	// or every file errors TS5097.
	expect(tsconfig.compilerOptions.allowImportingTsExtensions).toBe(true);
	expect(tsconfig.compilerOptions.noEmit).toBe(true);
	// React 19 dropped the global `JSX` namespace; templates must not use it.
	const index = await Bun.file(`${dir}/app/routes/index.tsx`).text();
	expect(index).not.toContain("JSX.Element");
	const todo = await Bun.file(`${dir}/app/islands/TodoApp.tsx`).text();
	expect(todo).not.toContain("JSX.Element");
	// Build-generated dirs are ignored; UI projects carry the css module type.
	const gitignore = await Bun.file(`${dir}/.gitignore`).text();
	expect(gitignore).toContain("patties-gen");
	expect(existsSync(`${dir}/app/styles/css.d.ts`)).toBe(true);
	const pkg = (await Bun.file(`${dir}/package.json`).json()) as {
		scripts: Record<string, string>;
	};
	expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
});

test("--no-ui leaves no components and no patties-ui dep", async () => {
	const { dir, code } = await scaffold("ui0", [
		"--type",
		"fullstack",
		"--no-ui",
	]);
	expect(code).toBe(0);
	expect(existsSync(`${dir}/app/components/ui`)).toBe(false);
	const pkg = (await Bun.file(`${dir}/package.json`).json()) as {
		devDependencies?: Record<string, string>;
	};
	expect(pkg.devDependencies?.["patties-ui"]).toBeUndefined();
});

test("--target container emits a Dockerfile; config target stays bun", async () => {
	const { dir, code } = await scaffold("box", [
		"--type",
		"fullstack",
		"--target",
		"container",
		"--no-ui",
	]);
	expect(code).toBe(0);
	expect(existsSync(`${dir}/Dockerfile`)).toBe(true);
	expect(existsSync(`${dir}/.dockerignore`)).toBe(true);
	const dockerfile = await Bun.file(`${dir}/Dockerfile`).text();
	expect(dockerfile).toContain("box");
	expect(dockerfile).not.toContain("{{name}}");
	const config = await Bun.file(`${dir}/patties.config.ts`).text();
	expect(config).toContain('target: "bun"');
});

test("--agent codex ships the patterns rule and no Claude files", async () => {
	const { dir, code } = await scaffold("cx", ["--agent", "codex"]);
	expect(code).toBe(0);
	expect(existsSync(`${dir}/.codex/rules/patties-patterns.md`)).toBe(true);
	expect(existsSync(`${dir}/CLAUDE.md`)).toBe(false);
	expect(existsSync(`${dir}/.claude`)).toBe(false);
	const agents = await Bun.file(`${dir}/AGENTS.md`).text();
	expect(agents).toContain(".codex/rules/patties-patterns.md");
});

test("--agent none ships neither skill nor rule", async () => {
	const { dir, code } = await scaffold("plain", ["--agent", "none"]);
	expect(code).toBe(0);
	expect(existsSync(`${dir}/.claude`)).toBe(false);
	expect(existsSync(`${dir}/.codex`)).toBe(false);
	expect(existsSync(`${dir}/CLAUDE.md`)).toBe(false);
	expect(existsSync(`${dir}/AGENTS.md`)).toBe(false);
});

test("--yes matches the default profile (claude, fullstack, ui, no monorepo, bun)", async () => {
	const { dir, code } = await scaffold("d", ["--yes"]);
	expect(code).toBe(0);
	expect(existsSync(`${dir}/CLAUDE.md`)).toBe(true);
	expect(existsSync(`${dir}/app/components/ui/button.tsx`)).toBe(true);
	expect(existsSync(`${dir}/apps`)).toBe(false);
	const config = await Bun.file(`${dir}/patties.config.ts`).text();
	expect(config).toContain('target: "bun"');
});

// --- drift guards -----------------------------------------------------------

test("vendored ui-starter matches patties-ui/templates byte-for-byte", async () => {
	const vendored = resolve(import.meta.dir, "../templates/ui-starter");
	const upstream = resolve(import.meta.dir, "../../patties-ui/templates");
	const files = [
		"button.tsx",
		"card.tsx",
		"input.tsx",
		"label.tsx",
		"_internal/cn.ts",
		"_internal/slot.ts",
		"_internal/variants.ts",
		"tokens.css",
		"themes/neutral/tokens.css",
		"themes/slate/tokens.css",
		"themes/stone/tokens.css",
		"themes/zinc/tokens.css",
	];
	for (const f of files) {
		const a = await Bun.file(`${vendored}/${f}`).text();
		const b = await Bun.file(`${upstream}/${f}`).text();
		expect(a).toBe(b);
	}
});

test("generated /patties skill + codex rule are up to date", async () => {
	const pkgRoot = resolve(import.meta.dir, "..");
	const proc = await Bun.$`bun run scripts/gen-patties-skill.ts --check`
		.cwd(pkgRoot)
		.quiet()
		.nothrow();
	expect(proc.exitCode).toBe(0);
});
