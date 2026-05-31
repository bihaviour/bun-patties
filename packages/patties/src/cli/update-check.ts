import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { isTTY } from "./log.ts";

// Best-effort "a newer patties is available" banner. Two hard rules:
//   1. Never block the CLI on the network — the banner prints from a local
//      cache; a stale cache is refreshed in the background (fire-and-forget).
//   2. Channel-aware — a stable install is compared against the `latest`
//      dist-tag, a prerelease (e.g. `0.1.0-next.3`) against its own pre tag,
//      so stable users are never nagged about release candidates.

const DIST_TAGS_URL = "https://registry.npmjs.org/-/package/patties/dist-tags";
const TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;

interface UpdateCache {
	checkedAt: number;
	latest: string;
}

// Exported for unit tests.
export function channelFor(version: string): string {
	const dash = version.indexOf("-");
	if (dash === -1) return "latest";
	const tag = version.slice(dash + 1).split(".")[0];
	return tag || "latest";
}

// Exported for unit tests. Uses Bun.semver when present (no-ops otherwise so a
// non-Bun test runner never throws — mirrors assertPluginCompat).
export function isNewerVersion(latest: string, current: string): boolean {
	const semver = (
		Bun as unknown as { semver?: { order(a: string, b: string): number } }
	).semver;
	if (!semver || typeof semver.order !== "function") return false;
	try {
		return semver.order(latest, current) === 1;
	} catch {
		return false;
	}
}

function cacheFile(): string {
	const base =
		process.env.XDG_CACHE_HOME ??
		(homedir() ? join(homedir(), ".cache") : tmpdir());
	return join(base, "patties", "update-check.json");
}

function optedOut(noUpdateCheck: boolean): boolean {
	if (noUpdateCheck) return true;
	if (process.env.CI) return true;
	if (process.env.NODE_ENV === "production") return true;
	if (process.env.NO_UPDATE_NOTIFIER) return true;
	if (process.env.PATTIES_NO_UPDATE_NOTIFIER) return true;
	return !isTTY(process.stdout);
}

async function readCache(): Promise<UpdateCache | null> {
	try {
		const file = Bun.file(cacheFile());
		if (!(await file.exists())) return null;
		const data = (await file.json()) as Partial<UpdateCache>;
		if (typeof data.latest === "string" && typeof data.checkedAt === "number") {
			return { latest: data.latest, checkedAt: data.checkedAt };
		}
	} catch {
		// unreadable / malformed cache → treat as absent
	}
	return null;
}

async function fetchLatest(channel: string): Promise<string | null> {
	try {
		const res = await fetch(DIST_TAGS_URL, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			headers: { accept: "application/json" },
		});
		if (!res.ok) return null;
		const tags = (await res.json()) as Record<string, string>;
		const v = tags[channel] ?? tags.latest;
		return typeof v === "string" ? v : null;
	} catch {
		return null;
	}
}

function printBanner(current: string, latest: string): void {
	const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
	const paint = (code: string, s: string) =>
		color ? `\x1b[${code}m${s}\x1b[0m` : s;

	type Seg = { text: string; code?: string };
	const lines: Seg[][] = [
		[
			{ text: "Update available   " },
			{ text: current, code: "2" },
			{ text: " → ", code: "36" },
			{ text: latest, code: "32" },
		],
		[
			{ text: "Run  " },
			{ text: "patties upgrade", code: "36" },
			{ text: "  to update" },
		],
	];

	const visLen = (segs: Seg[]) => segs.reduce((n, s) => n + s.text.length, 0);
	const inner = Math.max(...lines.map(visLen));
	const pad = 3;
	const width = inner + pad * 2;
	const border = (s: string) => paint("2", s);

	const top = border(`╭${"─".repeat(width)}╮`);
	const bottom = border(`╰${"─".repeat(width)}╯`);
	const blank = `${border("│")}${" ".repeat(width)}${border("│")}`;
	const body = lines.map((segs) => {
		const painted = segs.map((s) => (s.code ? paint(s.code, s.text) : s.text));
		const trailing = " ".repeat(inner - visLen(segs));
		return `${border("│")}${" ".repeat(pad)}${painted.join("")}${trailing}${" ".repeat(pad)}${border("│")}`;
	});

	const box = [top, blank, ...body, blank, bottom]
		.map((l) => `  ${l}`)
		.join("\n");
	process.stdout.write(`\n${box}\n\n`);
}

export async function notifyUpdate(
	currentVersion: string,
	noUpdateCheck: boolean,
): Promise<void> {
	if (optedOut(noUpdateCheck)) return;

	const cached = await readCache();
	if (cached && isNewerVersion(cached.latest, currentVersion)) {
		printBanner(currentVersion, cached.latest);
	}

	const stale = !cached || Date.now() - cached.checkedAt > TTL_MS;
	if (stale) {
		// Fire-and-forget: long-running `dev` finishes this during its session;
		// commands that outlast the fetch refresh too. We never await it.
		void fetchLatest(channelFor(currentVersion)).then(async (latest) => {
			if (latest) {
				try {
					await Bun.write(
						cacheFile(),
						JSON.stringify({ checkedAt: Date.now(), latest }),
					);
				} catch {
					// best-effort cache write
				}
			}
		});
	}
}
