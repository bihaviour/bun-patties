import { join } from "node:path";
import { loadConfigOrUsage } from "../../config/load.ts";
import type { CliContext } from "../index.ts";
import { EXIT, log } from "../log.ts";
import { resolveUiPaths, UiPathError } from "./add/ui-paths.ts";
import { gitTreeState } from "./ui/migrate/git-guard.ts";
import { rewriteRadix } from "./ui/migrate/radix.ts";
import { rewriteRtl } from "./ui/migrate/rtl.ts";

interface MigrateArgs {
	kind?: "radix" | "rtl";
	glob?: string;
	dryRun: boolean;
	force: boolean;
}

const PROD_MSG =
	"patties migrate is a dev-only tool; refusing to run with NODE_ENV=production.";

export async function runMigrate(
	argv: string[],
	ctx: CliContext,
): Promise<number> {
	const args = parseArgs(argv);

	if (args.kind === undefined) {
		printHelp();
		return EXIT.USAGE;
	}

	if (process.env.NODE_ENV === "production") {
		log.error(PROD_MSG);
		return EXIT.USAGE;
	}

	// Default glob: the resolved componentsDir.
	let glob = args.glob;
	if (glob === undefined) {
		const loaded = await loadConfigOrUsage({
			cwd: ctx.cwd,
			configPath: ctx.configPath,
		});
		if ("error" in loaded) {
			log.error(loaded.error);
			return EXIT.USAGE;
		}
		try {
			glob = resolveUiPaths({
				cwd: ctx.cwd,
				ui: loaded.config.ui,
			}).componentsDir;
		} catch (err) {
			if (err instanceof UiPathError) {
				log.error(err.message);
				return EXIT.USAGE;
			}
			throw err;
		}
	}

	if (!args.force) {
		const tree = await gitTreeState(ctx.cwd);
		if (!tree.isRepo) {
			log.error(
				"not a git repo — re-run with --force to apply the codemod anyway.",
			);
			return EXIT.USAGE;
		}
		if (!tree.clean) {
			log.error(
				"working tree is dirty — commit first, or re-run with --force.",
			);
			return EXIT.USAGE;
		}
	}

	const files = await collectFiles(ctx.cwd, glob, args.kind);
	if (files.length === 0) {
		log.warn(`no files matched: ${glob}`);
		return EXIT.OK;
	}

	let changedCount = 0;
	for (const file of files) {
		const source = await Bun.file(file).text();
		const result =
			args.kind === "radix"
				? rewriteRadix(source)
				: rewriteRtl(source, file.endsWith(".css"));

		for (const r of result.reports) log.warn(`  ${file}: ${r}`);

		if (!result.changed) continue;
		changedCount++;
		log.success(`  ${args.dryRun ? "would rewrite" : "rewrote"} ${file}`);
		if (!args.dryRun) await Bun.write(file, result.output);
	}

	if (args.dryRun) {
		log.dim(`dry-run: ${changedCount} file(s) would change. Nothing written.`);
	} else {
		log.dim(
			`done. ${changedCount} file(s) changed. Review the diff before commit.`,
		);
	}
	return EXIT.OK;
}

async function collectFiles(
	cwd: string,
	glob: string,
	kind: "radix" | "rtl",
): Promise<string[]> {
	// radix only touches TS/TSX; rtl also touches CSS.
	const pattern = kind === "rtl" ? "**/*.{ts,tsx,css}" : "**/*.{ts,tsx}";
	const root = join(cwd, glob);
	const out: string[] = [];
	const scanner = new Bun.Glob(pattern);
	for await (const rel of scanner.scan({ cwd: root, onlyFiles: true })) {
		out.push(join(root, rel));
	}
	return out;
}

function parseArgs(argv: string[]): MigrateArgs {
	const out: MigrateArgs = { dryRun: false, force: false };
	for (const a of argv) {
		if (a === "--dry-run") out.dryRun = true;
		else if (a === "--force") out.force = true;
		else if (a === "radix" || a === "rtl") out.kind = a;
		else if (!a.startsWith("-")) out.glob = a;
	}
	return out;
}

function printHelp(): void {
	process.stdout.write(`patties migrate — codemods for older shadcn-era source

Usage:
  patties migrate radix [<glob>] [--dry-run] [--force]
  patties migrate rtl   [<glob>] [--dry-run] [--force]

  radix   Rewrite @radix-ui/react-* imports to the unified radix-ui import.
  rtl     Rewrite physical CSS/Tailwind props to logical (ml-* -> ms-*, etc.).

Refuses to run on a dirty git tree without --force. Default glob: the resolved
components dir. Commit before applying.
`);
}
