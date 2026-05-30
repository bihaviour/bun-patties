// Writes the generated manifest to a target file while preserving any
// human-written content around it. The manifest lives between two HTML
// comment markers so regeneration is a deterministic in-place splice — rules
// or notes above (and below) the section survive every `patties dev/build`.

export const MANIFEST_START = "<!-- patties:manifest-start -->";
export const MANIFEST_END = "<!-- patties:manifest-end -->";

const SECTION_RE = new RegExp(
	`${escapeRe(MANIFEST_START)}[\\s\\S]*?${escapeRe(MANIFEST_END)}`,
);

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wrap(manifest: string): string {
	const body = manifest.endsWith("\n") ? manifest : `${manifest}\n`;
	return `${MANIFEST_START}\n${body}${MANIFEST_END}`;
}

export async function writeManifestToFile(
	path: string,
	manifest: string,
): Promise<void> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		await Bun.write(path, `${wrap(manifest)}\n`);
		return;
	}
	const existing = await file.text();
	if (SECTION_RE.test(existing)) {
		await Bun.write(path, existing.replace(SECTION_RE, wrap(manifest)));
		return;
	}
	const sep = existing.endsWith("\n") ? "\n" : "\n\n";
	await Bun.write(path, `${existing}${sep}${wrap(manifest)}\n`);
}
