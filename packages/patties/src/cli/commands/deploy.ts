import { loadConfig } from "../../config/load.ts";
import {
	type DeployPlugin,
	isDeployPlugin,
	type Plugin,
	type PluginLogger,
} from "../../plugin/index.ts";
import { runBuild } from "../build.ts";
import type { CliContext } from "../index.ts";
import { EXIT, log } from "../log.ts";

interface DeployArgs {
	target?: "bun" | "edge";
	env?: string;
	skipBuild: boolean;
}

const NO_PLUGIN_HINT = (
	target: string,
): string => `No deploy plugin installed for target "${target}".
  Install one of:
    bun add @patties/deploy-cloudflare
    bun add @patties/deploy-vercel
    bun add @patties/deploy-deno
    bun add @patties/deploy-netlify
  Or write your own — see framework spec 09-plugins.`;

const pluginLogger: PluginLogger = {
	info: (m, ...rest) =>
		log.info(`${m}${rest.length ? ` ${rest.join(" ")}` : ""}`),
	warn: (m, ...rest) =>
		log.warn(`${m}${rest.length ? ` ${rest.join(" ")}` : ""}`),
	error: (m, ...rest) =>
		log.error(`${m}${rest.length ? ` ${rest.join(" ")}` : ""}`),
};

export async function runDeploy(
	argv: string[],
	ctx: CliContext,
): Promise<number> {
	const args = parseArgs(argv);

	let loaded: Awaited<ReturnType<typeof loadConfig>>;
	try {
		loaded = await loadConfig({
			cwd: ctx.cwd,
			configPath: ctx.configPath,
			overrides: args.target ? { target: args.target } : undefined,
		});
	} catch (err) {
		log.error((err as Error)?.message ?? String(err));
		return EXIT.ERROR;
	}
	const { config } = loaded;
	const target = config.target;

	if (!args.skipBuild) {
		const passthrough: string[] = ["--target", target];
		const code = await runBuild(passthrough, ctx);
		if (code !== EXIT.OK) return code;
	} else {
		const serverEntry = `${config.outDir}/server/server-entry.js`;
		if (!(await Bun.file(serverEntry).exists())) {
			log.error(
				`--skip-build set but no prior build found at ${config.outDir}. Run 'patties build' first.`,
			);
			return EXIT.ERROR;
		}
	}

	const plugins = (config.plugins ?? []) as Plugin[];
	const candidates = plugins
		.filter(isDeployPlugin)
		.filter((p) => p.deployTarget === target);

	if (candidates.length === 0) {
		if (target === "bun") {
			log.info(
				`No deploy plugin installed. To run: bun ${config.outDir}/server/server-entry.js`,
			);
			return EXIT.OK;
		}
		log.error(NO_PLUGIN_HINT(target));
		return EXIT.USAGE;
	}

	let plugin: DeployPlugin | undefined;
	if (args.env) {
		plugin = candidates.find((p) => p.name === args.env);
		if (!plugin) {
			log.error(
				`no deploy plugin matches --env "${args.env}" for target "${target}"`,
			);
			return EXIT.USAGE;
		}
	} else {
		plugin = candidates[0];
		if (candidates.length > 1) {
			log.warn(
				`multiple deploy plugins for "${target}"; using "${plugin?.name}". Pass --env <name> to select.`,
			);
		}
	}

	if (!plugin) return EXIT.ERROR;

	const serverEntry = `${config.outDir}/server/server-entry.js`;
	log.success(`built  (target ${target})`);
	log.info(`deploying via ${plugin.name}…`);

	try {
		const url = await plugin.deploy(
			{ outDir: config.outDir, serverEntry },
			{ env: args.env, cwd: ctx.cwd, logger: pluginLogger },
		);
		if (typeof url === "string" && url.length > 0) {
			log.success(`live at ${url}`);
		} else {
			log.success(`deploy complete (${plugin.name})`);
		}
		return EXIT.OK;
	} catch (err) {
		log.error(
			`[plugin ${plugin.name}] deploy failed: ${(err as Error)?.message ?? String(err)}`,
		);
		return EXIT.ERROR;
	}
}

function parseArgs(argv: string[]): DeployArgs {
	const out: DeployArgs = { skipBuild: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--target") out.target = String(argv[++i]) as "bun" | "edge";
		else if (a.startsWith("--target="))
			out.target = a.slice(9) as "bun" | "edge";
		else if (a === "--env") out.env = String(argv[++i]);
		else if (a.startsWith("--env=")) out.env = a.slice(6);
		else if (a === "--skip-build") out.skipBuild = true;
	}
	return out;
}
