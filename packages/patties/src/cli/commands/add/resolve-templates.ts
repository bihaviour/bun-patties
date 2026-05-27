import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let cached: string | undefined;

export async function resolveTemplatesDir(): Promise<string> {
	if (cached) return cached;
	const pkgUrl = import.meta.resolve("patties-ui/package.json");
	const pkgPath = pkgUrl.startsWith("file:") ? fileURLToPath(pkgUrl) : pkgUrl;
	const dir = resolve(dirname(pkgPath), "templates");
	cached = dir;
	return dir;
}

export function setTemplatesDirForTest(dir: string | undefined): void {
	cached = dir;
}
