import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import { applyComponent } from "../../src/cli/commands/add/apply.ts";
import type { Catalog } from "../../src/cli/commands/add/load-catalog.ts";
import {
	mapShadcnItem,
	parseShadcnItem,
	rewriteRegistryImports,
	splitDep,
} from "../../src/cli/commands/add/shadcn.ts";
import {
	cleanupSources,
	type ResolvedSource,
	resolveSources,
} from "../../src/cli/commands/add/source.ts";
import { resolveUiPaths } from "../../src/cli/commands/add/ui-paths.ts";

const FIXTURES = join(import.meta.dir, "__fixtures__", "shadcn");
const BASE = "https://ui.shadcn.com/r/styles/new-york-v4";
const catalog: Catalog = {
	components,
	templatesDir: join(
		import.meta.dir,
		"..",
		"..",
		"..",
		"patties-ui",
		"templates",
	),
};

async function fixture(name: string): Promise<{
	files: Array<{ content: string }>;
}> {
	return Bun.file(join(FIXTURES, `${name}.json`)).json();
}

// Serves the vendored upstream registry items and a fake npm "latest" lookup.
function upstream(): { fetch: typeof fetch; requested: string[] } {
	const requested: string[] = [];
	const impl = (async (input: string | URL | Request) => {
		const url = typeof input === "string" ? input : input.toString();
		requested.push(url);
		const npm = url.match(/^https:\/\/registry\.npmjs\.org\/(.+)\/latest$/);
		if (npm) return Response.json({ name: npm[1], version: "1.2.3" });
		const item = url.match(/\/([^/]+)\.json$/)?.[1];
		const file = Bun.file(join(FIXTURES, `${item}.json`));
		if (!item || !(await file.exists())) {
			return new Response("not found", { status: 404 });
		}
		return new Response(file);
	}) as typeof fetch;
	return { fetch: impl, requested };
}

let workdir: string;
let sources: ResolvedSource[] = [];

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "patties-add-shadcn-"));
	await Bun.write(
		join(workdir, "package.json"),
		`${JSON.stringify({ name: "app", dependencies: { react: "^19.0.0" } }, null, "\t")}\n`,
	);
});

afterEach(async () => {
	await cleanupSources(sources);
	sources = [];
	await rm(workdir, { recursive: true, force: true });
});

describe("mapper", () => {
	test("rewrites @/registry/<style>/… imports the way the shadcn CLI does", () => {
		const src = [
			'import { Button } from "@/registry/new-york-v4/ui/button"',
			"import { useIsMobile } from '@/registry/new-york-v4/hooks/use-mobile'",
			'import { cn } from "cn"',
		].join("\n");
		expect(rewriteRegistryImports(src)).toBe(
			[
				'import { Button } from "@/components/ui/button"',
				"import { useIsMobile } from '@/hooks/use-mobile'",
				'import { cn } from "cn"',
			].join("\n"),
		);
	});

	test("splits scoped and versioned dependency specs", () => {
		expect(splitDep("radix-ui")).toEqual({ name: "radix-ui" });
		expect(splitDep("@radix-ui/react-dialog@^1.1.0")).toEqual({
			name: "@radix-ui/react-dialog",
			range: "^1.1.0",
		});
	});

	test("maps dialog: ui destination, island no, deps, inferred button dep", async () => {
		const raw = await fixture("dialog");
		const { payload, registryDeps, unpinned } = mapShadcnItem(
			parseShadcnItem(raw, "dialog.json"),
			"dialog.json",
		);
		expect(payload.entry.island).toBe("no");
		expect(payload.entry.files).toEqual([
			{ from: "shadcn/components/dialog.tsx", to: "dialog.tsx" },
		]);
		expect(payload.entry.peerDeps).toEqual({
			cn: "latest",
			"lucide-react": "latest",
			"radix-ui": "latest",
		});
		// lucide-react is imported (XIcon) but not declared upstream.
		expect(unpinned).toEqual(["cn", "radix-ui", "lucide-react"]);
		// Not declared upstream, but imported — must be stamped too.
		expect(registryDeps).toEqual(["button"]);
	});

	test("hooks land under the app dir; cssVars become a token group", () => {
		const { payload } = mapShadcnItem(
			parseShadcnItem(
				{
					name: "themed",
					type: "registry:hook",
					files: [
						{
							path: "registry/new-york-v4/hooks/use-themed.ts",
							type: "registry:hook",
							content: "export const useThemed = () => 1\n",
						},
					],
					cssVars: {
						light: { brand: "oklch(0.5 0.1 200)" },
						dark: { brand: "oklch(0.9 0.1 200)" },
					},
				},
				"themed.json",
			),
			"themed.json",
		);
		expect(payload.entry.files).toEqual([
			{
				from: "shadcn/app/hooks/use-themed.ts",
				to: "hooks/use-themed.ts",
				root: "app",
			},
		]);
		expect(payload.entry.tokens).toEqual(["shadcn-themed"]);
		expect(payload.templates["tokens.css"]).toContain(
			":root {\n  --brand: oklch(0.5 0.1 200);\n}",
		);
		expect(payload.templates["tokens.css"]).toContain(".dark {");
	});

	test("file targets are confined to app/{components,hooks,lib}", () => {
		const item = (target: string) =>
			parseShadcnItem(
				{
					name: "t",
					type: "registry:page",
					files: [
						{ path: "x.tsx", type: "registry:page", target, content: "" },
					],
				},
				"t.json",
			);
		for (const hostile of [
			".github/workflows/pwn.yml",
			"package.json",
			"bunfig.toml",
			"app/routes/evil.tsx",
			"app/middleware.ts",
			"~/app/lib/.env",
			"../outside.ts",
		]) {
			expect(() => mapShadcnItem(item(hostile), "t.json")).toThrow(
				/outside app\/\{components,hooks,lib\}/,
			);
		}
		const ok = mapShadcnItem(item("~/app/components/widget.tsx"), "t.json");
		expect(ok.payload.entry.files[0]).toMatchObject({
			to: "components/widget.tsx",
			root: "app",
		});
	});

	test("unknown item shapes fail loudly", () => {
		expect(() =>
			parseShadcnItem(
				{ name: "x", type: "registry:style", files: [] },
				"x.json",
			),
		).toThrow(/unsupported shape/);
	});
});

describe("patties add @shadcn/<name>", () => {
	test("resolves the built-in namespace and its registry deps, pinned", async () => {
		const up = upstream();
		sources =
			(await resolveSources(["@shadcn/dialog"], {
				catalog,
				registries: {},
				cwd: workdir,
				allowInsecure: false,
				fetchImpl: up.fetch,
			})) ?? [];
		expect(sources.map((s) => s.entry.name)).toEqual(["button", "dialog"]);
		expect(up.requested).toContain(`${BASE}/dialog.json`);
		expect(up.requested).toContain(`${BASE}/button.json`);
		expect(sources[1]?.entry.peerDeps).toEqual({
			cn: "^1.2.3",
			"lucide-react": "^1.2.3",
			"radix-ui": "^1.2.3",
		});
		expect(sources.every((s) => !s.fromCatalog)).toBeTrue();
	});

	test("config.ui.registries overrides the @shadcn base", async () => {
		const up = upstream();
		sources =
			(await resolveSources(["@shadcn/button"], {
				catalog,
				registries: { "@shadcn": "https://mirror.example/r" },
				cwd: workdir,
				allowInsecure: false,
				fetchImpl: up.fetch,
			})) ?? [];
		expect(up.requested[0]).toBe("https://mirror.example/r/button.json");
	});

	test("http registries are rejected without --allow-insecure", async () => {
		const up = upstream();
		const res = await resolveSources(["@shadcn/button"], {
			catalog,
			registries: { "@shadcn": "http://mirror.example/r" },
			cwd: workdir,
			allowInsecure: false,
			fetchImpl: up.fetch,
		});
		expect(res).toBeNull();
		expect(up.requested).toEqual([]);
	});

	test("stamps upstream source verbatim and patches deps without installing", async () => {
		const up = upstream();
		sources =
			(await resolveSources(["@shadcn/dialog"], {
				catalog,
				registries: {},
				cwd: workdir,
				allowInsecure: false,
				fetchImpl: up.fetch,
			})) ?? [];
		const uiPaths = resolveUiPaths({ cwd: workdir });
		for (const s of sources) {
			await applyComponent(s.entry, workdir, uiPaths, s.templatesDir, {
				force: false,
			});
		}

		const upstreamDialog = (await fixture("dialog")).files[0]?.content ?? "";
		const stamped = await Bun.file(
			join(workdir, "app/components/ui/dialog.tsx"),
		).text();
		expect(stamped).toBe(rewriteRegistryImports(upstreamDialog));
		expect(stamped.startsWith('"use client"')).toBeTrue();
		expect(stamped).toContain('from "@/components/ui/button"');
		expect(
			await Bun.file(join(workdir, "app/components/ui/button.tsx")).exists(),
		).toBeTrue();

		const pkg = (await Bun.file(join(workdir, "package.json")).json()) as {
			dependencies: Record<string, string>;
		};
		expect(pkg.dependencies).toEqual({
			cn: "^1.2.3",
			"class-variance-authority": "^1.2.3",
			"lucide-react": "^1.2.3",
			"radix-ui": "^1.2.3",
			react: "^19.0.0",
		});
		expect(await Bun.file(join(workdir, "node_modules")).exists()).toBeFalse();
		expect(await Bun.file(join(workdir, "bun.lock")).exists()).toBeFalse();
	});

	test("the stamper refuses app-rooted files outside the allowlist from any payload", async () => {
		const uiPaths = resolveUiPaths({ cwd: workdir });
		const tpl = await mkdtemp(join(tmpdir(), "patties-add-shadcn-tpl-"));
		await Bun.write(join(tpl, "evil.tsx"), "export function GET() {}\n");
		try {
			await expect(
				applyComponent(
					{
						name: "evil",
						spec: "remote:evil",
						phase: 0,
						kind: "primitive",
						island: "no",
						status: "completed",
						files: [{ from: "evil.tsx", to: "routes/evil.ts", root: "app" }],
						peerDeps: {},
						internalHelpers: [],
					},
					workdir,
					uiPaths,
					tpl,
					{ force: false },
				),
			).rejects.toThrow(/only components\/, hooks\/, lib\//);
			expect(
				await Bun.file(join(workdir, "app/routes/evil.ts")).exists(),
			).toBeFalse();
		} finally {
			await rm(tpl, { recursive: true, force: true });
		}
	});

	test("a local registry-item .json is mapped like a remote one", async () => {
		const up = upstream();
		sources =
			(await resolveSources([join(FIXTURES, "use-mobile.json")], {
				catalog,
				registries: {},
				cwd: workdir,
				allowInsecure: false,
				fetchImpl: up.fetch,
			})) ?? [];
		const uiPaths = resolveUiPaths({ cwd: workdir });
		const [hook] = sources;
		if (!hook) throw new Error("no source");
		await applyComponent(hook.entry, workdir, uiPaths, hook.templatesDir, {
			force: false,
		});
		expect(
			await Bun.file(join(workdir, "app/hooks/use-mobile.ts")).exists(),
		).toBeTrue();
	});
});
