import { join } from "node:path";
import type { CliContext } from "../index.ts";
import { EXIT, log } from "../log.ts";
import { loadCatalog } from "./add/load-catalog.ts";
import { writeComponentView } from "./ui/view.ts";

// `patties view <component>` — alias for `patties add --view`. Read-only.
export async function runView(
	argv: string[],
	ctx: CliContext,
): Promise<number> {
	const names = argv.filter((a) => !a.startsWith("-"));
	if (names.length === 0) {
		log.error("usage: patties view <component>");
		return EXIT.USAGE;
	}

	if (!(await Bun.file(join(ctx.cwd, "package.json")).exists())) {
		log.error(`not a Patties project (no package.json found at ${ctx.cwd})`);
		return EXIT.USAGE;
	}

	const catalog = await loadCatalog(ctx.cwd);
	if (!catalog) {
		log.error(
			"patties-ui is not installed. Run `bun add -D patties-ui` to enable component view.",
		);
		return EXIT.USAGE;
	}

	for (const name of names) {
		const entry = catalog.components.find((c) => c.name === name);
		if (!entry) {
			log.error(`unknown component: ${name}`);
			return EXIT.USAGE;
		}
		await writeComponentView(entry, catalog.templatesDir);
	}
	return EXIT.OK;
}
