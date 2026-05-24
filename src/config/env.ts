export class MissingEnv extends Error {
	names: string[];
	constructor(names: string[]) {
		super(`MissingEnv: ${names.join(", ")}`);
		this.name = "MissingEnv";
		this.names = names;
	}
}

type EnvSource = Record<string, string | undefined>;

function defaultSource(): EnvSource {
	return (typeof Bun !== "undefined" ? Bun.env : process.env) as EnvSource;
}

export function getEnv(name: string, source?: EnvSource): string | undefined {
	const src = source ?? defaultSource();
	const v = src[name];
	if (v === undefined || v === "") return undefined;
	return v;
}

export function validateRequiredEnv(
	required: string[],
	source?: EnvSource,
): void {
	const src = source ?? defaultSource();
	const missing: string[] = [];
	for (const name of required) {
		const v = src[name];
		if (v === undefined || v === "") missing.push(name);
	}
	if (missing.length > 0) throw new MissingEnv(missing);
}
