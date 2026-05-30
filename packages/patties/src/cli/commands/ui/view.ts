import { join } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import { isTTY } from "../../log.ts";

export interface RenderedView {
	// Metadata block — written to stderr so stdout stays pipeable.
	header: string;
	// Concatenated template source(s) — written to stdout, valid .tsx.
	source: string;
}

const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

// Render a component's metadata + the full source of every file it would stamp.
// Pure (no writes) so both `patties view` and `patties add --view` can reuse it.
export async function renderComponentSource(
	entry: ComponentEntry,
	templatesDir: string,
	opts: { color: boolean },
): Promise<RenderedView> {
	const c = opts.color;
	const label = (s: string) => (c ? `${DIM}${s}${RESET}` : s);
	const name = (s: string) => (c ? `${CYAN}${s}${RESET}` : s);

	const deps = Object.entries(entry.peerDeps)
		.map(([n, r]) => `${n}@${r}`)
		.join(", ");
	const headerLines = [
		`${name(entry.name)}`,
		`${label("phase")}    ${entry.phase}`,
		`${label("kind")}     ${entry.kind}`,
		`${label("island")}   ${entry.island}`,
		`${label("status")}   ${entry.status}`,
		`${label("peerDeps")} ${deps || "—"}`,
		`${label("helpers")}  ${entry.internalHelpers.join(", ") || "—"}`,
		`${label("tokens")}   ${(entry.tokens ?? []).join(", ") || "—"}`,
	];

	const parts: string[] = [];
	for (const f of entry.files) {
		const src = await Bun.file(join(templatesDir, f.from)).text();
		const fence = `// ──── ${f.to} ────`;
		parts.push(`${c ? `${DIM}${fence}${RESET}` : fence}\n${src}`);
	}

	return {
		header: headerLines.join("\n"),
		source: parts.join("\n"),
	};
}

// Render and emit: metadata → stderr, source → stdout (pipeable escape hatch).
export async function writeComponentView(
	entry: ComponentEntry,
	templatesDir: string,
): Promise<void> {
	const color = isTTY(process.stdout) && !process.env.NO_COLOR;
	const r = await renderComponentSource(entry, templatesDir, { color });
	process.stderr.write(`${r.header}\n\n`);
	process.stdout.write(`${r.source}\n`);
}
