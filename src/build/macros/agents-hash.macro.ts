// Bun macro: hashes AGENTS.md (if present) for dev-banner cache busting.
// Returns "" when the file is absent. Consumed by spec 05 (dev/HMR) — declared
// here so the macro contract from spec 04 holds even before dev paths land.
export async function AGENTS_HASH(appDir: string): Promise<string> {
	const file = Bun.file(appDir.replace(/\/+$/, "") + "/AGENTS.md");
	if (!(await file.exists())) return "";
	const bytes = await file.bytes();
	return Bun.hash.xxHash64(bytes).toString(16);
}
