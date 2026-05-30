import { dirname, resolve } from "node:path";
import type { ComponentEntry } from "patties-ui/types";

export interface Catalog {
	components: ComponentEntry[];
	templatesDir: string;
}

let testOverride: Catalog | undefined;

export function setCatalogForTest(catalog: Catalog | undefined): void {
	testOverride = catalog;
}

export async function loadCatalog(cwd: string): Promise<Catalog | null> {
	if (testOverride) return testOverride;
	let registryPath: string;
	let pkgPath: string;
	try {
		registryPath = Bun.resolveSync("patties-ui/registry", cwd);
		pkgPath = Bun.resolveSync("patties-ui/package.json", cwd);
	} catch {
		return null;
	}
	const mod = (await import(registryPath)) as {
		components?: ComponentEntry[];
	};
	if (!Array.isArray(mod.components)) {
		throw new Error(
			`patties-ui at ${registryPath} did not export a \`components\` array`,
		);
	}
	const templatesDir = resolve(dirname(pkgPath), "templates");
	return { components: mod.components, templatesDir };
}
