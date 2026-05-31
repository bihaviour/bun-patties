import { join } from "node:path";
import pkg from "../../../package.json" with { type: "json" };
import type { CliContext } from "../index.ts";
import { EXIT, log } from "../log.ts";

const FRAMEWORK_VERSION = (pkg as { version: string }).version;

// Mirror update-check's channel detection so an upgrade stays on the same line:
// a prerelease install upgrades to the newest prerelease, stable to `latest`.
function channelTag(version: string): string {
	const dash = version.indexOf("-");
	if (dash === -1) return "latest";
	return version.slice(dash + 1).split(".")[0] || "latest";
}

// `patties upgrade [--dry-run]` — bump the project's `patties` dependency to the
// newest version on its channel via `bun add`. This is the one place the CLI is
// allowed to invoke an install, because the user asked for it explicitly.
export async function runUpgrade(
	argv: string[],
	ctx: CliContext,
): Promise<number> {
	if (process.env.NODE_ENV === "production") {
		log.error("patties upgrade is a dev-time command; not for production.");
		return EXIT.USAGE;
	}

	if (!(await Bun.file(join(ctx.cwd, "package.json")).exists())) {
		log.error(`not a Patties project (no package.json found at ${ctx.cwd})`);
		return EXIT.USAGE;
	}

	const spec = `patties@${channelTag(FRAMEWORK_VERSION)}`;

	if (argv.includes("--dry-run")) {
		log.dim(`(dry run) would run: bun add ${spec}`);
		return EXIT.OK;
	}

	log.info(`Upgrading ${spec} in ${ctx.cwd} …`);
	const proc = Bun.spawn(["bun", "add", spec], {
		cwd: ctx.cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await proc.exited;
	if (code !== 0) {
		log.error(`bun add ${spec} failed (exit ${code})`);
		return EXIT.ERROR;
	}
	log.success(`patties upgraded (${spec}).`);
	return EXIT.OK;
}
