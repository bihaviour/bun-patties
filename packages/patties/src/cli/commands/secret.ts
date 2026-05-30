import { loadConfig } from "../../config/load.ts";
import {
	getSecretsApi,
	isLibsecretError,
	isProductionEnv,
	resolveServiceName,
} from "../../config/secrets.ts";
import type { CliContext } from "../index.ts";
import { EXIT, log } from "../log.ts";

interface SecretArgs {
	sub: "set" | "get" | "list" | "rm" | "doctor" | "help" | undefined;
	key?: string;
	value?: string;
	force: boolean;
}

const PROD_MSG =
	"patties secret is a dev-only tool. In production, set values via your host's secrets surface.";

const LIBSECRET_HINT =
	"OS keychain backend unavailable. On Debian/Ubuntu: sudo apt install libsecret-1-dev";

export async function runSecret(
	argv: string[],
	ctx: CliContext,
): Promise<number> {
	const args = parseArgs(argv);

	if (!args.sub || args.sub === "help") {
		printHelp();
		return EXIT.OK;
	}

	if (isProductionEnv() && args.sub !== "doctor") {
		log.error(PROD_MSG);
		return EXIT.USAGE;
	}

	if (args.sub === "doctor") {
		return runDoctor(ctx);
	}

	const api = getSecretsApi();
	if (!api) {
		log.error(LIBSECRET_HINT);
		return EXIT.USAGE;
	}

	const service = await resolveServiceName(ctx.cwd);

	switch (args.sub) {
		case "set":
			return cmdSet(api, service, args);
		case "get":
			return cmdGet(api, service, args);
		case "list":
			return cmdList(api, service);
		case "rm":
			return cmdRm(api, service, args);
		default:
			printHelp();
			return EXIT.USAGE;
	}
}

function parseArgs(argv: string[]): SecretArgs {
	const out: SecretArgs = { sub: undefined, force: false };
	const positional: string[] = [];
	for (const a of argv) {
		if (a === "--force") out.force = true;
		else positional.push(a);
	}
	const [sub, key, value] = positional;
	if (
		sub === "set" ||
		sub === "get" ||
		sub === "list" ||
		sub === "rm" ||
		sub === "doctor" ||
		sub === "help"
	) {
		out.sub = sub;
	}
	out.key = key;
	out.value = value;
	return out;
}

async function cmdSet(
	api: ReturnType<typeof getSecretsApi>,
	service: string,
	args: SecretArgs,
): Promise<number> {
	if (!api?.set) {
		log.error(LIBSECRET_HINT);
		return EXIT.USAGE;
	}
	if (!args.key) {
		log.error("usage: patties secret set <key> [value]");
		return EXIT.USAGE;
	}
	let value = args.value;
	if (value === undefined) {
		value = await readValue();
	}
	if (value === undefined || value === "") {
		log.error("no value provided");
		return EXIT.USAGE;
	}
	try {
		await api.set({ service, name: args.key, value });
	} catch (err) {
		if (isLibsecretError(err)) {
			log.error(LIBSECRET_HINT);
			return EXIT.USAGE;
		}
		throw err;
	}
	log.success(`stored ${args.key} (service: ${service})`);
	return EXIT.OK;
}

async function cmdGet(
	api: ReturnType<typeof getSecretsApi>,
	service: string,
	args: SecretArgs,
): Promise<number> {
	if (!api) return EXIT.USAGE;
	if (!args.key) {
		log.error("usage: patties secret get <key>");
		return EXIT.USAGE;
	}
	let value: string | null | undefined;
	try {
		value = await api.get({ service, name: args.key });
	} catch (err) {
		if (isLibsecretError(err)) {
			log.error(LIBSECRET_HINT);
			return EXIT.USAGE;
		}
		throw err;
	}
	if (!value) {
		log.error(`unset: ${args.key}`);
		return EXIT.ERROR;
	}
	if (!process.stdout.isTTY && !args.force) {
		log.error(
			"refusing to print secret to non-TTY stdout. Pass --force to override.",
		);
		return EXIT.USAGE;
	}
	process.stdout.write(`${value}\n`);
	return EXIT.OK;
}

async function cmdList(
	api: ReturnType<typeof getSecretsApi>,
	service: string,
): Promise<number> {
	if (!api?.list) {
		log.error(LIBSECRET_HINT);
		return EXIT.USAGE;
	}
	let keys: string[] = [];
	try {
		keys = await api.list({ service });
	} catch (err) {
		if (isLibsecretError(err)) {
			log.error(LIBSECRET_HINT);
			return EXIT.USAGE;
		}
		throw err;
	}
	if (keys.length === 0) {
		log.dim(`(no secrets in service ${service})`);
		return EXIT.OK;
	}
	for (const key of keys) {
		let value: string | null | undefined;
		try {
			value = await api.get({ service, name: key });
		} catch {
			value = "";
		}
		log.info(`  ${key}  ${maskValue(value ?? "")}`);
	}
	return EXIT.OK;
}

async function cmdRm(
	api: ReturnType<typeof getSecretsApi>,
	service: string,
	args: SecretArgs,
): Promise<number> {
	if (!api?.delete) {
		log.error(LIBSECRET_HINT);
		return EXIT.USAGE;
	}
	if (!args.key) {
		log.error("usage: patties secret rm <key>");
		return EXIT.USAGE;
	}
	try {
		await api.delete({ service, name: args.key });
		log.success(`removed ${args.key}`);
	} catch (err) {
		if (isLibsecretError(err)) {
			log.error(LIBSECRET_HINT);
			return EXIT.USAGE;
		}
		log.dim(`(no such key: ${args.key})`);
	}
	return EXIT.OK;
}

async function runDoctor(ctx: CliContext): Promise<number> {
	const { config } = await loadConfig({
		cwd: ctx.cwd,
		configPath: ctx.configPath,
	});
	const keys = config.secrets ?? [];
	if (keys.length === 0) {
		log.dim("(no entries in config.secrets)");
		return EXIT.OK;
	}
	const api = getSecretsApi();
	const service = await resolveServiceName(ctx.cwd);
	for (const key of keys) {
		const source = await classify(api, service, key);
		log.info(`  ${pad(key, 24)} ${source}`);
	}
	return EXIT.OK;
}

async function classify(
	api: ReturnType<typeof getSecretsApi>,
	service: string,
	key: string,
): Promise<string> {
	if (api) {
		try {
			const v = await api.get({ service, name: key });
			if (v) return "keychain";
		} catch {
			// fall through
		}
	}
	if (process.env[key]) return "Bun.env";
	return "missing";
}

function maskValue(value: string): string {
	if (value.length >= 8) return `••••${value.slice(-4)}`;
	return "••••";
}

function pad(s: string, n: number): string {
	if (s.length >= n) return s;
	return s + " ".repeat(n - s.length);
}

async function readValue(): Promise<string | undefined> {
	if (!process.stdin.isTTY) {
		const text = await Bun.stdin.text();
		const nl = text.indexOf("\n");
		const value = nl === -1 ? text : text.slice(0, nl);
		return value || undefined;
	}
	process.stdout.write("value: ");
	const stdin = process.stdin as NodeJS.ReadStream & {
		setRawMode?: (mode: boolean) => void;
	};
	stdin.setRawMode?.(true);
	stdin.resume();
	return await new Promise<string | undefined>((resolveValue) => {
		let buf = "";
		const onData = (chunk: Buffer): void => {
			const s = chunk.toString("utf8");
			for (const ch of s) {
				if (ch === "\r" || ch === "\n") {
					stdin.setRawMode?.(false);
					stdin.pause();
					stdin.off("data", onData);
					process.stdout.write("\n");
					resolveValue(buf || undefined);
					return;
				}
				if (ch === "") {
					// Ctrl-C
					stdin.setRawMode?.(false);
					process.exit(EXIT.INTERRUPTED);
				}
				if (ch === "") {
					buf = buf.slice(0, -1);
				} else {
					buf += ch;
				}
			}
		};
		stdin.on("data", onData);
	});
}

function printHelp(): void {
	process.stdout.write(`patties secret — manage dev-time secrets

Usage:
  patties secret set <key> [value]
  patties secret get <key>           [--force]
  patties secret list
  patties secret rm <key>
  patties secret doctor
`);
}
