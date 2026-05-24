import { resolve } from "node:path";
import type { PattiesConfig } from "./schema.ts";

export interface LoadSecretsOptions {
	cwd?: string;
	serviceName?: string;
}

function isProduction(): boolean {
	const env = (typeof Bun !== "undefined" ? Bun.env : process.env) as Record<
		string,
		string | undefined
	>;
	return env.PATTIES_ENV === "production" || env.NODE_ENV === "production";
}

async function resolveServiceName(
	cwd: string,
	override?: string,
): Promise<string> {
	if (override) return override;
	try {
		const pkgPath = resolve(cwd, "package.json");
		if (await Bun.file(pkgPath).exists()) {
			const pkg = (await Bun.file(pkgPath).json()) as { name?: string };
			if (pkg.name) return pkg.name;
		}
	} catch {
		// fall through to default
	}
	return "patties";
}

interface BunSecretsLike {
	get: (opts: {
		service: string;
		name: string;
	}) => Promise<string | null | undefined>;
}

function getSecretsApi(): BunSecretsLike | null {
	const b = (globalThis as { Bun?: { secrets?: unknown } }).Bun;
	if (!b || !b.secrets) return null;
	return b.secrets as BunSecretsLike;
}

export async function loadSecrets(
	config: PattiesConfig,
	options: LoadSecretsOptions = {},
): Promise<void> {
	if (isProduction()) return;
	if (!config.secrets || config.secrets.length === 0) return;

	try {
		const api = getSecretsApi();
		if (!api) return;

		const cwd = options.cwd ?? process.cwd();
		const serviceName = await resolveServiceName(cwd, options.serviceName);
		const env = (typeof Bun !== "undefined" ? Bun.env : process.env) as Record<
			string,
			string | undefined
		>;

		let backendOk = true;
		for (const key of config.secrets) {
			if (!backendOk) break;
			try {
				const value = await api.get({ service: serviceName, name: key });
				if (value) {
					env[key] = value;
					if (typeof process !== "undefined") process.env[key] = value;
				}
			} catch (err) {
				const msg = (err as Error)?.message ?? String(err);
				if (/libsecret|keyring|keychain|backend/i.test(msg)) {
					console.warn(
						`[patties] Bun.secrets backend unavailable; falling back to env (${msg})`,
					);
					backendOk = false;
				}
				// else: silently fall through to env for this key
			}
		}
	} catch (err) {
		console.warn(
			`[patties] loadSecrets skipped: ${(err as Error)?.message ?? String(err)}`,
		);
	}
}
