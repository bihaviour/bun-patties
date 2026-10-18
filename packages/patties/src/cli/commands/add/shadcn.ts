import { basename } from "node:path";
import { SafeRelPath } from "patties-ui/schema";
import type { ComponentEntry, ComponentFile } from "patties-ui/types";
import { z } from "zod";
import { type ComponentPayload, RegistryError } from "./registry-fetch.ts";

// Adapter from the upstream shadcn/ui registry-item JSON
// (https://ui.shadcn.com/schema/registry-item.json) to a patties payload. The
// stamped source stays byte-for-byte upstream except for the
// `@/registry/<style>/…` → `@/…` import rewrite the shadcn CLI applies too.

// Built-in namespaces, overridable via config.ui.registries. new-york-v4 is the
// Tailwind v4 style, matching the patties token pipeline.
export const DEFAULT_REGISTRIES: Record<string, string> = {
	"@shadcn": "https://ui.shadcn.com/r/styles/new-york-v4",
};

const ItemType = z.enum([
	"registry:ui",
	"registry:lib",
	"registry:hook",
	"registry:component",
	"registry:block",
	"registry:page",
	"registry:file",
]);

const CssVars = z.record(z.string(), z.string());

// Validated strictly where the mapper depends on a field; everything else
// (`$schema`, title, docs, meta, …) passes through untouched.
const ShadcnItemSchema = z.object({
	name: z.string().min(1),
	type: ItemType,
	dependencies: z.array(z.string()).optional(),
	devDependencies: z.array(z.string()).optional(),
	registryDependencies: z.array(z.string()).optional(),
	files: z
		.array(
			z.object({
				path: z.string().min(1),
				content: z.string(),
				type: ItemType,
				target: z.string().optional(),
			}),
		)
		.min(1),
	cssVars: z
		.object({
			theme: CssVars.optional(),
			light: CssVars.optional(),
			dark: CssVars.optional(),
		})
		.optional(),
});

type ShadcnItem = z.infer<typeof ShadcnItemSchema>;

export interface MappedItem {
	payload: ComponentPayload;
	// Upstream names, `@ns/name` refs, or URLs this item needs stamped first.
	registryDeps: string[];
	// Deps declared without a version; the caller pins them before stamping.
	unpinned: string[];
}

// A shadcn item has typed `files` with inline `content` and no patties
// `entry` wrapper.
export function isShadcnItem(raw: unknown): boolean {
	if (typeof raw !== "object" || raw === null || "entry" in raw) return false;
	const r = raw as { type?: unknown; files?: unknown };
	return (
		typeof r.type === "string" &&
		r.type.startsWith("registry:") &&
		Array.isArray(r.files)
	);
}

export function parseShadcnItem(raw: unknown, source: string): ShadcnItem {
	const parsed = ShadcnItemSchema.safeParse(raw);
	if (!parsed.success) {
		throw new RegistryError(
			`shadcn registry item from ${source} has an unsupported shape: ${parsed.error.issues
				.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
				.join("; ")}`,
		);
	}
	return parsed.data;
}

const REGISTRY_IMPORT_RE =
	/(["'])@\/registry\/[^/"']+\/(ui|lib|hooks|components|blocks)\/([^"']+)\1/g;

const ALIAS_DIR: Record<string, string> = {
	ui: "components/ui",
	lib: "lib",
	hooks: "hooks",
	components: "components",
	blocks: "components",
};

// `@/registry/new-york-v4/ui/button` → `@/components/ui/button`, the same
// default-alias rewrite `npx shadcn add` performs. Nothing else is touched.
export function rewriteRegistryImports(source: string): string {
	return source.replace(
		REGISTRY_IMPORT_RE,
		(_m, q: string, kind: string, rest: string) =>
			`${q}@/${ALIAS_DIR[kind] ?? kind}/${rest}${q}`,
	);
}

// Sibling registry items a file imports. Upstream items don't always list
// these in `registryDependencies`, but the stamped file can't build without
// them.
function inferRegistryDeps(source: string): string[] {
	const out: string[] = [];
	for (const m of source.matchAll(REGISTRY_IMPORT_RE)) {
		const rest = m[3] ?? "";
		const name = rest.split("/")[0]?.replace(/\.[jt]sx?$/, "");
		if (name) out.push(name);
	}
	return out;
}

const BARE_IMPORT_RE =
	/(?:from|import)\s*["']([^"'./@][^"']*|@[^/"']+\/[^"']+)["']/g;
// Provided by every patties app; never written into package.json.
const HOST_PACKAGES = new Set(["react", "react-dom"]);

// npm packages a file imports. Upstream items sometimes omit one from
// `dependencies` (button → class-variance-authority) because the shadcn CLI
// assumes its init already installed it.
function inferPackageDeps(source: string): string[] {
	const out: string[] = [];
	for (const m of source.matchAll(BARE_IMPORT_RE)) {
		const spec = m[1] ?? "";
		const parts = spec.split("/");
		const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
		if (name && !HOST_PACKAGES.has(name) && !name.startsWith("bun:")) {
			out.push(name);
		}
	}
	return out;
}

function destination(
	file: ShadcnItem["files"][number],
): Pick<ComponentFile, "to" | "root"> {
	const base = basename(file.path);
	if (file.target) {
		const rel = file.target.replace(/^~\//, "").replace(/^\.\//, "");
		const safe = SafeRelPath.safeParse(rel);
		if (!safe.success) {
			throw new RegistryError(`unsafe shadcn file target: ${file.target}`);
		}
		return { to: rel, root: "project" };
	}
	switch (file.type) {
		case "registry:ui":
			return { to: base };
		case "registry:lib":
			return { to: `lib/${base}`, root: "app" };
		case "registry:hook":
			return { to: `hooks/${base}`, root: "app" };
		case "registry:component":
		case "registry:block":
			return { to: `components/${base}`, root: "app" };
		default:
			throw new RegistryError(
				`shadcn file ${file.path} (${file.type}) needs a \`target\``,
			);
	}
}

// `name@range` with scoped names (`@radix-ui/react-dialog@^1.1.0`).
export function splitDep(spec: string): { name: string; range?: string } {
	const at = spec.lastIndexOf("@");
	if (at > 0) return { name: spec.slice(0, at), range: spec.slice(at + 1) };
	return { name: spec };
}

function tokenBlock(group: string, cssVars: ShadcnItem["cssVars"]): string {
	const rule = (selector: string, vars?: Record<string, string>) =>
		vars && Object.keys(vars).length > 0
			? `${selector} {\n${Object.entries(vars)
					.map(([k, v]) => `  --${k}: ${v};`)
					.join("\n")}\n}\n`
			: "";
	return `/* @patties:tokens ${group} */
${rule("@theme inline", cssVars?.theme)}${rule(":root", cssVars?.light)}${rule(".dark", cssVars?.dark)}/* @patties:end ${group} */`;
}

export function mapShadcnItem(item: ShadcnItem, source: string): MappedItem {
	const templates: Record<string, string> = {};
	const files: ComponentFile[] = [];
	const inferred: string[] = [];
	const importedPackages: string[] = [];
	for (const f of item.files) {
		const dest = destination(f);
		const from = `shadcn/${dest.root ?? "components"}/${dest.to}`;
		templates[from] = rewriteRegistryImports(f.content);
		inferred.push(...inferRegistryDeps(f.content));
		importedPackages.push(...inferPackageDeps(f.content));
		// Omit `root` for component files so the entry validates against older
		// patties-ui schemas too.
		files.push(dest.root ? { from, ...dest } : { from, to: dest.to });
	}

	const peerDeps: Record<string, string> = {};
	const unpinned: string[] = [];
	for (const spec of item.dependencies ?? []) {
		const { name, range } = splitDep(spec);
		peerDeps[name] = range ?? "latest";
		if (!range) unpinned.push(name);
	}
	for (const name of importedPackages) {
		if (name in peerDeps) continue;
		peerDeps[name] = "latest";
		unpinned.push(name);
	}

	let tokens: string[] | undefined;
	const vars = item.cssVars;
	if (vars && (vars.theme || vars.light || vars.dark)) {
		const group = `shadcn-${item.name}`;
		templates["tokens.css"] = tokenBlock(group, vars);
		tokens = [group];
	}

	const entry: ComponentEntry = {
		name: item.name,
		spec: `shadcn:${source}`,
		phase: 0,
		kind: item.type === "registry:block" ? "recipe" : "primitive",
		// Hydration is the page's job (`export const hydrate = true`), not the
		// component's.
		island: "no",
		status: "completed",
		files,
		peerDeps,
		internalHelpers: [],
		...(tokens ? { tokens } : {}),
	};

	const registryDeps = [
		...new Set([...(item.registryDependencies ?? []), ...inferred]),
	].filter((d) => d !== item.name);

	return { payload: { entry, templates }, registryDeps, unpinned };
}

// Turn bare `latest` into `^<current>` via the npm registry so stamped apps
// don't float on every install. Best effort: offline keeps `latest`.
export async function pinDeps(
	peerDeps: Record<string, string>,
	names: string[],
	fetchImpl: typeof fetch = fetch,
): Promise<Record<string, string>> {
	const out = { ...peerDeps };
	await Promise.all(
		names.map(async (name) => {
			try {
				const res = await fetchImpl(
					`https://registry.npmjs.org/${name}/latest`,
				);
				if (!res.ok) return;
				const { version } = (await res.json()) as { version?: unknown };
				if (typeof version === "string") out[name] = `^${version}`;
			} catch {}
		}),
	);
	return out;
}
