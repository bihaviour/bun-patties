// `patties doctor` — aggregate read-only project-hygiene checks into one report
// with a concrete remedy per finding and a CI-friendly exit code. Phase 1 is
// report-only: it never installs or mutates. See cli/20-doctor.

import { join } from "node:path";
import { loadConfigOrUsage } from "../config/load.ts";
import { checkConfig } from "./doctor/config-checks.ts";
import { checkDeps, SEVERITY_ORDER, type Severity } from "./doctor/deps.ts";
import { checkMonorepo } from "./doctor/monorepo.ts";
import { renderJson, renderText, summarize } from "./doctor/report.ts";
import { checkToolchain } from "./doctor/toolchain.ts";
import type { DoctorReport, Summary } from "./doctor/types.ts";
import type { CliContext } from "./index.ts";
import { EXIT, log } from "./log.ts";

const CONFIG_CANDIDATES = [
	"patties.config.ts",
	"patties.config.js",
	"patties.config.mjs",
];

interface DoctorArgs {
	json: boolean;
	offline: boolean;
	noAudit: boolean;
	noOutdated: boolean;
	strict: boolean;
	auditLevel: string;
}

function parseArgs(argv: string[]): DoctorArgs {
	const out: DoctorArgs = {
		json: false,
		offline: false,
		noAudit: false,
		noOutdated: false,
		strict: false,
		auditLevel: "high",
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--json") out.json = true;
		else if (a === "--offline") out.offline = true;
		else if (a === "--no-audit") out.noAudit = true;
		else if (a === "--no-outdated") out.noOutdated = true;
		else if (a === "--strict") out.strict = true;
		else if (a === "--audit-level") out.auditLevel = String(argv[++i]);
		else if (a.startsWith("--audit-level="))
			out.auditLevel = a.slice("--audit-level=".length);
	}
	return out;
}

async function hasConfig(cwd: string, configPath?: string): Promise<boolean> {
	if (configPath) return Bun.file(configPath).exists();
	for (const name of CONFIG_CANDIDATES) {
		if (await Bun.file(join(cwd, name)).exists()) return true;
	}
	return false;
}

export async function runDoctor(
	argv: string[],
	ctx: CliContext = { cwd: process.cwd(), verbose: false },
): Promise<number> {
	const args = parseArgs(argv);

	if (!SEVERITY_ORDER.includes(args.auditLevel as Severity)) {
		log.error(
			`invalid --audit-level "${args.auditLevel}" (expected ${SEVERITY_ORDER.join(" | ")})`,
		);
		return EXIT.USAGE;
	}
	const auditLevel = args.auditLevel as Severity;

	// Pre-flight: exit 2 when doctor cannot run at all.
	if (!Bun.which("bun")) {
		log.error("`bun` not found in PATH — doctor cannot run.");
		return EXIT.USAGE;
	}
	if (!(await hasConfig(ctx.cwd, ctx.configPath))) {
		log.error(
			"not a patties project (no patties.config.ts found). Run inside a patties app.",
		);
		return EXIT.USAGE;
	}

	// `appDir` for the single-React check; tolerate an invalid config here (C.7
	// reports it) by falling back to the conventional ./app.
	const loaded = await loadConfigOrUsage({
		cwd: ctx.cwd,
		configPath: ctx.configPath,
	});
	const appDir =
		"config" in loaded ? loaded.config.appDir : join(ctx.cwd, "app");

	const toolchain = checkToolchain(ctx.cwd);
	const [deps, config, monorepo] = await Promise.all([
		checkDeps(ctx.cwd, {
			offline: args.offline,
			noAudit: args.noAudit,
			noOutdated: args.noOutdated,
			auditLevel,
		}),
		checkConfig(ctx.cwd, ctx.configPath),
		checkMonorepo(ctx.cwd, appDir, import.meta.dir),
	]);

	const checks = [...toolchain, ...deps, ...config, ...monorepo];
	const report: DoctorReport = { checks, summary: summarize(checks) };

	process.stdout.write(args.json ? renderJson(report) : renderText(report));

	return decideExit(report.summary, args.strict);
}

/** A fail always gates; under `--strict` a warning gates too. `skip` never does. */
export function decideExit(summary: Summary, strict: boolean): number {
	if (summary.failed > 0) return EXIT.ERROR;
	if (strict && summary.warning > 0) return EXIT.ERROR;
	return EXIT.OK;
}
