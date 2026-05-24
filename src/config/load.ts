import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import {
	type PattiesConfig,
	type PattiesConfigInput,
	PattiesConfigSchema,
} from "./schema.ts";

const CANDIDATES = [
	"patties.config.ts",
	"patties.config.js",
	"patties.config.mjs",
];

export interface LoadedConfig {
	config: PattiesConfig;
	path: string | null;
}

export interface LoadOptions {
	cwd: string;
	configPath?: string;
	overrides?: Partial<PattiesConfigInput>;
}

export class ConfigNotFoundError extends Error {
	constructor(public readonly path: string) {
		super(`patties config not found: ${path}`);
		this.name = "ConfigNotFoundError";
	}
}

interface CacheEntry {
	hash: bigint;
	raw: unknown;
}
const fileCache = new Map<string, CacheEntry>();

export async function loadConfig(
	arg: string | LoadOptions = process.cwd(),
): Promise<LoadedConfig> {
	const opts: LoadOptions = typeof arg === "string" ? { cwd: arg } : { ...arg };
	const cwd = opts.cwd;

	let found: string | null;
	if (opts.configPath) {
		const abs = isAbsolute(opts.configPath)
			? opts.configPath
			: resolve(cwd, opts.configPath);
		if (!(await Bun.file(abs).exists())) {
			throw new ConfigNotFoundError(abs);
		}
		found = abs;
	} else {
		found = await findConfigFile(cwd);
	}

	let raw: unknown = {};
	if (found) {
		raw = await readWithCache(found);
	}

	const merged = mergeOverrides(raw, opts.overrides);
	const parsed = parseOrThrow(merged, found);

	parsed.appDir = absolutize(parsed.appDir, cwd);
	parsed.outDir = absolutize(parsed.outDir, cwd);

	return { config: parsed, path: found };
}

async function readWithCache(path: string): Promise<unknown> {
	const bytes = await Bun.file(path).bytes();
	const hash = Bun.hash(bytes) as bigint;
	const cached = fileCache.get(path);
	if (cached && cached.hash === hash) return cached.raw;
	const mod = (await import(`${path}?h=${hash}`)) as { default?: unknown };
	const raw = mod.default ?? {};
	fileCache.set(path, { hash, raw });
	return raw;
}

function parseOrThrow(raw: unknown, where: string | null): PattiesConfig {
	try {
		return PattiesConfigSchema.parse(raw);
	} catch (err) {
		if (err instanceof z.ZodError) {
			const lines = err.issues.map(
				(i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`,
			);
			throw new Error(
				`patties config invalid (${where ?? "<defaults>"}):\n${lines.join("\n")}`,
			);
		}
		throw err;
	}
}

function mergeOverrides(
	raw: unknown,
	overrides?: Partial<PattiesConfigInput>,
): unknown {
	if (!overrides) return raw;
	const base = (raw ?? {}) as Record<string, unknown>;
	const out: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(overrides) as [string, unknown][]) {
		if (value === undefined) continue;
		if (
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value) &&
			typeof base[key] === "object" &&
			base[key] !== null &&
			!Array.isArray(base[key])
		) {
			out[key] = {
				...(base[key] as Record<string, unknown>),
				...(value as Record<string, unknown>),
			};
		} else {
			out[key] = value;
		}
	}
	return out;
}

async function findConfigFile(cwd: string): Promise<string | null> {
	for (const name of CANDIDATES) {
		const p = resolve(cwd, name);
		if (await Bun.file(p).exists()) return p;
	}
	return null;
}

function absolutize(p: string, cwd: string): string {
	return isAbsolute(p) ? p : resolve(cwd, p);
}
