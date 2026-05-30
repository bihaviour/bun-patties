import { join } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import { formatUnifiedDiff } from "./diff.ts";
import { INTERNAL_FILES } from "./internal.ts";
import type { Catalog } from "./load-catalog.ts";
import { extractBlock } from "./tokens.ts";
import type { UiPaths } from "./ui-paths.ts";

export type DiffStatus = "not-stamped" | "up-to-date" | "drift";

export interface DiffItem {
	label: string;
	status: DiffStatus;
	body: string; // unified diff, empty unless status === "drift"
}

async function diffPair(
	label: string,
	localPath: string,
	templatePath: string,
	color: boolean,
): Promise<DiffItem> {
	if (!(await Bun.file(localPath).exists())) {
		return { label, status: "not-stamped", body: "" };
	}
	const local = await Bun.file(localPath).text();
	const incoming = await Bun.file(templatePath).text();
	if (local === incoming) return { label, status: "up-to-date", body: "" };
	const body = formatUnifiedDiff(local, incoming, {
		fromLabel: `${label} (local)`,
		toLabel: `${label} (catalog)`,
		color,
	});
	return { label, status: "drift", body };
}

// Diff a component's files, helpers, and token block against the catalog.
export async function diffComponentItems(
	entry: ComponentEntry,
	uiPaths: UiPaths,
	templatesDir: string,
	color: boolean,
): Promise<DiffItem[]> {
	const items: DiffItem[] = [];

	for (const f of entry.files) {
		items.push(
			await diffPair(
				f.to,
				join(uiPaths.componentsDir, f.to),
				join(templatesDir, f.from),
				color,
			),
		);
	}

	for (const h of entry.internalHelpers) {
		const file = INTERNAL_FILES[h];
		items.push(
			await diffPair(
				`_internal/${file}`,
				join(uiPaths.internalDir, file),
				join(templatesDir, "_internal", file),
				color,
			),
		);
	}

	for (const group of entry.tokens ?? []) {
		items.push(await diffTokenGroup(group, uiPaths, templatesDir, color));
	}

	return items;
}

async function diffTokenGroup(
	group: string,
	uiPaths: UiPaths,
	templatesDir: string,
	color: boolean,
): Promise<DiffItem> {
	const label = `tokens:${group}`;
	const incoming = extractBlock(
		await Bun.file(join(templatesDir, "tokens.css")).text(),
		group,
	);
	if (incoming === null) return { label, status: "up-to-date", body: "" };
	if (!(await Bun.file(uiPaths.tokensFile).exists())) {
		return { label, status: "not-stamped", body: "" };
	}
	const local = extractBlock(await Bun.file(uiPaths.tokensFile).text(), group);
	if (local === null) return { label, status: "not-stamped", body: "" };
	if (local === incoming) return { label, status: "up-to-date", body: "" };
	const body = formatUnifiedDiff(local, incoming, {
		fromLabel: `${label} (local)`,
		toLabel: `${label} (catalog)`,
		color,
	});
	return { label, status: "drift", body };
}

// Components whose first file is already present under componentsDir.
export async function listStampedComponents(
	catalog: Catalog,
	uiPaths: UiPaths,
): Promise<ComponentEntry[]> {
	const out: ComponentEntry[] = [];
	for (const c of catalog.components) {
		const first = c.files[0];
		if (!first) continue;
		if (await Bun.file(join(uiPaths.componentsDir, first.to)).exists()) {
			out.push(c);
		}
	}
	return out;
}
