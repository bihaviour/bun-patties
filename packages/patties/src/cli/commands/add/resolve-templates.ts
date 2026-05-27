import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let cached: string | undefined;

export function resolveTemplatesDir(): string {
	if (cached) return cached;
	const here = fileURLToPath(import.meta.url);
	const dir = resolve(dirname(here), "..", "..", "..", "..", "templates", "ui");
	cached = dir;
	return dir;
}

export function setTemplatesDirForTest(dir: string | undefined): void {
	cached = dir;
}
