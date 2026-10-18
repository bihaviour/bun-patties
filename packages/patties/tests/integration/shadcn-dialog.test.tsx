import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import { act } from "react";
import { build } from "../../src/build/index.ts";
import { applyComponent } from "../../src/cli/commands/add/apply.ts";
import { setCatalogForTest } from "../../src/cli/commands/add/load-catalog.ts";
import {
	cleanupSources,
	resolveSources,
} from "../../src/cli/commands/add/source.ts";
import { resolveUiPaths } from "../../src/cli/commands/add/ui-paths.ts";
import { runUiInit } from "../../src/cli/commands/ui/init.ts";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";

// End to end for the RFC acceptance criterion: `patties add @shadcn/dialog`
// stamps upstream source, and the verbatim Dialog opens/closes — function
// props and shared context intact — inside a page exporting `hydrate = true`.
//
// The project lives under tests/fixtures so `react` / `radix-ui` resolve from
// the workspace node_modules, the way they would after `bun install`.
const SHADCN = join(import.meta.dir, "..", "cli", "__fixtures__", "shadcn");
const TEMPLATES = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"patties-ui",
	"templates",
);
const PROJECT = join(
	import.meta.dir,
	"..",
	"fixtures",
	`.tmp-shadcn-${process.pid}`,
);
const APP = join(PROJECT, "app");

const PAGE = `import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

export const hydrate = true;

export default function Home() {
	const [open, setOpen] = React.useState(false);
	return (
		<main>
			<p id="state">{open ? "open" : "closed"}</p>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>
					<Button id="trigger">Edit profile</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogTitle>Profile</DialogTitle>
					<DialogDescription>Make changes here.</DialogDescription>
				</DialogContent>
			</Dialog>
		</main>
	);
}
`;

const errors: string[] = [];
const originalError = console.error;
let registered = false;

// Serve the vendored upstream registry; pin npm deps to fixed versions.
const upstream = (async (input: string | URL | Request) => {
	const url = typeof input === "string" ? input : input.toString();
	if (url.startsWith("https://registry.npmjs.org/")) {
		return Response.json({ version: "1.0.0" });
	}
	const name = url.match(/\/([^/]+)\.json$/)?.[1] ?? "";
	return new Response(Bun.file(join(SHADCN, `${name}.json`)));
}) as typeof fetch;

beforeAll(async () => {
	await Bun.write(
		join(PROJECT, "package.json"),
		`${JSON.stringify({ name: "shadcn-app", private: true }, null, "\t")}\n`,
	);
	await Bun.write(
		join(PROJECT, "tsconfig.json"),
		`${JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }, null, "\t")}\n`,
	);
	await Bun.write(join(APP, "routes", "index.tsx"), PAGE);

	setCatalogForTest({ components, templatesDir: TEMPLATES });
	const ctx = { cwd: PROJECT, verbose: false };
	expect(
		await runUiInit({ dryRun: false, force: false, shadcn: true }, ctx),
	).toBe(0);

	const sources =
		(await resolveSources(["@shadcn/dialog"], {
			catalog: { components, templatesDir: TEMPLATES },
			registries: {},
			cwd: PROJECT,
			allowInsecure: false,
			fetchImpl: upstream,
		})) ?? [];
	const uiPaths = resolveUiPaths({ cwd: PROJECT });
	try {
		for (const s of sources) {
			await applyComponent(s.entry, PROJECT, uiPaths, s.templatesDir, {
				force: false,
			});
		}
	} finally {
		await cleanupSources(sources);
	}
	setCatalogForTest(undefined);

	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	if (typeof document === "undefined") {
		const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
		GlobalRegistrator.register({ url: "http://localhost/" });
		registered = true;
	}
	console.error = (...args: unknown[]) => {
		const msg = args.map(String).join(" ");
		// SSR and hydration share one JS realm in this test; browsers don't.
		if (msg.includes("multiple renderers concurrently")) return;
		errors.push(msg);
	};
});

afterAll(async () => {
	const { resetPageRuntime } = await import("../../src/client/page.ts");
	// Flush the unmount inside act(): React would otherwise schedule its
	// cleanup for after happy-dom is torn down below.
	await act(async () => {
		resetPageRuntime();
	});
	console.error = originalError;
	if (registered) {
		const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
		await GlobalRegistrator.unregister();
	}
	await Bun.$`rm -rf ${PROJECT}`.quiet();
});

test("init --shadcn wires the @/ alias and @/lib/utils", async () => {
	const tsconfig = (await Bun.file(join(PROJECT, "tsconfig.json")).json()) as {
		compilerOptions: { paths: Record<string, string[]> };
	};
	expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./app/*"]);
	expect(await Bun.file(join(APP, "lib", "utils.ts")).text()).toBe(
		'export { cn } from "../components/ui/_internal/cn.ts";\n',
	);
});

test("the hydrated page bundles the stamped dialog", async () => {
	const out = (await Bun.$`mktemp -d -t patties-shadcn.XXXXXX`.text()).trim();
	try {
		const res = await build({ appDir: APP, outDir: out, mode: "production" });
		expect(Object.keys(res.clientManifest.pages)).toEqual(["/"]);
	} finally {
		await Bun.$`rm -rf ${out} ${join(APP, "patties-gen")}`.quiet();
	}
});

test("verbatim upstream Dialog opens and closes after whole-tree hydration", async () => {
	const renderer = createRenderer({
		manifest: {
			entry: null,
			islands: {},
			pages: { "/": "/_patties/client/x.js" },
		},
	});
	const router = await createRouter({ appDir: APP, renderer });
	const get = (
		router.routes["/"] as Record<string, (r: Request) => Promise<Response>>
	).GET;
	if (!get) throw new Error("no GET /");
	const html = await (
		await get(Object.assign(new Request("http://localhost/"), { params: {} }))
	).text();
	const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "";
	document.body.innerHTML = body.replace(
		/<script type="module"[^>]*><\/script>/,
		"",
	);

	const page = await import(join(APP, "routes", "index.tsx"));
	const { bootPage } = await import("../../src/client/page.ts");
	await act(async () => {
		bootPage("/", { Page: page.default });
	});
	expect(errors).toEqual([]);

	const state = () => document.getElementById("state")?.textContent;
	expect(state()).toBe("closed");
	await act(async () => {
		(document.getElementById("trigger") as HTMLButtonElement).click();
	});
	expect(state()).toBe("open");
	expect(document.body.textContent).toContain("Make changes here.");

	// The upstream DialogContent renders its own close button (sr-only "Close").
	const close = [...document.querySelectorAll("button")].find(
		(b) => b.textContent === "Close",
	);
	if (!close) throw new Error("close button not rendered");
	await act(async () => {
		close.click();
	});
	expect(state()).toBe("closed");
	expect(document.body.textContent).not.toContain("Make changes here.");
	expect(errors).toEqual([]);
});
