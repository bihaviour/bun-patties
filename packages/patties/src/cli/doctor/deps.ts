// Group B — dependency hygiene. Runs and contextualizes Bun's own commands
// (`bun audit`, `bun outdated`) plus a local lockfile-sync check. The parsers
// are pure so they can be unit-tested without a network round-trip.
//
// Note: `bun outdated --json` is NOT supported on Bun 1.3.x — the flag is
// silently ignored and a markdown table is printed — so B.5 parses the table.

import { join } from "node:path";
import type { Finding, Status } from "./types.ts";

export type Severity = "low" | "moderate" | "high" | "critical";

export const SEVERITY_ORDER: readonly Severity[] = [
	"low",
	"moderate",
	"high",
	"critical",
];

function severityRank(s: Severity): number {
	return SEVERITY_ORDER.indexOf(s);
}

export interface DepsOptions {
	offline: boolean;
	noAudit: boolean;
	noOutdated: boolean;
	auditLevel: Severity;
}

export interface OutdatedEntry {
	name: string;
	current: string;
	latest: string;
	major: boolean;
}

export interface Advisory {
	name: string;
	severity: Severity;
}

/** Leading-numeric major component of a version (e.g. "^1.2.3" → 1). */
function majorOf(version: string): number {
	const m = version.match(/(\d+)/);
	return m ? Number.parseInt(m[1] as string, 10) : 0;
}

/**
 * Parse the markdown table `bun outdated` prints. Header + `|---` separators are
 * dropped; a ` (dev)` / ` (peer)` / ` (optional)` suffix on the package name is
 * stripped. Returns `[]` for an empty result.
 */
export function parseOutdatedTable(text: string): OutdatedEntry[] {
	const out: OutdatedEntry[] = [];
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line.startsWith("|")) continue;
		const cells = line
			.slice(1, line.endsWith("|") ? -1 : undefined)
			.split("|")
			.map((c) => c.trim());
		const first = cells[0] ?? "";
		if (first === "" || first === "Package") continue; // header
		if (first.startsWith("-")) continue; // separator row
		const name = first.replace(/\s+\((dev|peer|optional)\)$/, "");
		const current = cells[1] ?? "";
		const latest = cells[3] ?? cells[cells.length - 1] ?? "";
		if (!current || !latest) continue;
		out.push({
			name,
			current,
			latest,
			major: majorOf(current) !== majorOf(latest),
		});
	}
	return out;
}

function asSeverity(value: unknown): Severity | null {
	return value === "low" ||
		value === "moderate" ||
		value === "high" ||
		value === "critical"
		? value
		: null;
}

/**
 * Extract advisories from `bun audit --json`. The exact shape varies (npm-style
 * `advisories` keyed by id, or `vulnerabilities` keyed by package); tolerate
 * both and ignore anything that doesn't carry a recognizable severity.
 */
export function parseAuditJson(text: string): Advisory[] {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return [];
	}
	if (!data || typeof data !== "object") return [];
	const out: Advisory[] = [];

	const collect = (entry: unknown, fallbackName: string): void => {
		if (!entry || typeof entry !== "object") return;
		const rec = entry as Record<string, unknown>;
		const severity = asSeverity(rec.severity);
		if (!severity) return;
		const name =
			(typeof rec.module_name === "string" && rec.module_name) ||
			(typeof rec.name === "string" && rec.name) ||
			fallbackName;
		out.push({ name, severity });
	};

	const root = data as Record<string, unknown>;
	const advisories = root.advisories;
	if (advisories && typeof advisories === "object") {
		for (const v of Object.values(advisories)) collect(v, "unknown");
	}
	const vulns = root.vulnerabilities;
	if (vulns && typeof vulns === "object" && !Array.isArray(vulns)) {
		for (const [name, v] of Object.entries(vulns)) collect(v, name);
	}
	return out;
}

/** Build the audit finding from parsed advisories, gated on `auditLevel`. */
export function auditFinding(
	advisories: Advisory[],
	auditLevel: Severity,
): Finding {
	if (advisories.length === 0) {
		return {
			id: "audit",
			group: "Dependencies",
			status: "pass",
			detail: "no known security advisories",
		};
	}
	const threshold = severityRank(auditLevel);
	const failing = advisories.filter(
		(a) => severityRank(a.severity) >= threshold,
	);
	const list = failing.length > 0 ? failing : advisories;
	const top = [...list].sort(
		(a, b) => severityRank(b.severity) - severityRank(a.severity),
	)[0] as Advisory;
	const status: Status = failing.length > 0 ? "fail" : "warn";
	const count = list.length;
	const noun = count === 1 ? "advisory" : "advisories";
	return {
		id: "audit",
		group: "Dependencies",
		status,
		detail: `${count} ${top.severity} severity ${noun} (e.g. ${top.name})`,
		remedy: `bun update ${top.name}`,
	};
}

/** Build the outdated finding from parsed entries (never a failure). */
export function outdatedFinding(entries: OutdatedEntry[]): Finding {
	if (entries.length === 0) {
		return {
			id: "outdated",
			group: "Dependencies",
			status: "pass",
			detail: "all dependencies up to date",
		};
	}
	const majors = entries.filter((e) => e.major);
	const majorNote =
		majors.length > 0
			? ` (${majors.length} major: ${majors
					.slice(0, 1)
					.map((e) => `${e.name} ${majorOf(e.current)} → ${majorOf(e.latest)}`)
					.join(", ")})`
			: "";
	return {
		id: "outdated",
		group: "Dependencies",
		status: "warn",
		detail: `${entries.length} outdated${majorNote}`,
		remedy: "bun outdated   to review",
	};
}

interface PackageJsonDeps {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

/** Escape a package name for use inside a RegExp. */
function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Name-level lockfile sync: every dependency / devDependency declared in the
 * root package.json must appear as a quoted token in `bun.lock`. A declared dep
 * absent from the lock means the lockfile is stale (a `bun install` is owed).
 */
export async function checkLockfile(root: string): Promise<Finding> {
	const lockFile = Bun.file(join(root, "bun.lock"));
	if (!(await lockFile.exists())) {
		return {
			id: "lockfile",
			group: "Dependencies",
			status: "fail",
			detail: "bun.lock is missing",
			remedy: "bun install",
		};
	}
	const lockText = await lockFile.text();

	let pkg: PackageJsonDeps = {};
	try {
		pkg = (await Bun.file(
			join(root, "package.json"),
		).json()) as PackageJsonDeps;
	} catch {
		// A missing/invalid root package.json surfaces in config checks; treat the
		// lock as in-sync here rather than double-reporting.
		return {
			id: "lockfile",
			group: "Dependencies",
			status: "pass",
			detail: "lockfile in sync",
		};
	}

	const declared = [
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
	];
	const missing = declared.filter(
		(name) => !new RegExp(`"${escapeRe(name)}"`).test(lockText),
	);

	if (missing.length > 0) {
		const shown = missing.slice(0, 3).join(", ");
		const more = missing.length > 3 ? `, +${missing.length - 3} more` : "";
		return {
			id: "lockfile",
			group: "Dependencies",
			status: "fail",
			detail: `lockfile out of sync — not in bun.lock: ${shown}${more}`,
			remedy: "bun install",
		};
	}
	return {
		id: "lockfile",
		group: "Dependencies",
		status: "pass",
		detail: "lockfile in sync",
	};
}

function skipped(id: string, detail: string): Finding {
	return { id, group: "Dependencies", status: "skip", detail };
}

/** Run group B: audit + outdated concurrently (subject to flags), then lockfile. */
export async function checkDeps(
	root: string,
	opts: DepsOptions,
): Promise<Finding[]> {
	const auditTask = (async (): Promise<Finding | null> => {
		if (opts.noAudit) return null;
		if (opts.offline)
			return skipped("audit", "security audit skipped (offline)");
		const text = await Bun.$`bun audit --json --audit-level=${opts.auditLevel}`
			.cwd(root)
			.nothrow()
			.quiet()
			.text();
		return auditFinding(parseAuditJson(text), opts.auditLevel);
	})();

	const outdatedTask = (async (): Promise<Finding | null> => {
		if (opts.noOutdated) return null;
		if (opts.offline)
			return skipped("outdated", "outdated check skipped (offline)");
		const text = await Bun.$`bun outdated`.cwd(root).nothrow().quiet().text();
		return outdatedFinding(parseOutdatedTable(text));
	})();

	const [audit, outdated, lockfile] = await Promise.all([
		auditTask,
		outdatedTask,
		checkLockfile(root),
	]);

	return [audit, outdated, lockfile].filter((f): f is Finding => f !== null);
}
