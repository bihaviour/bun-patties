import { ComponentEntrySchema } from "patties-ui/schema";
import type { ComponentEntry } from "patties-ui/types";
import { z } from "zod";
import { INTERNAL_FILES } from "./internal.ts";

// A self-contained component payload as emitted by `patties ui build`: the entry
// plus every template source it references, keyed by the same relative paths
// used in `files[].from` / `_internal/<helper>.ts` / `tokens.css`. One fetch per
// component, no directory walking (cli/15).
export interface ComponentPayload {
	entry: ComponentEntry;
	templates: Record<string, string>;
}

export interface FetchOptions {
	allowInsecure: boolean;
	// Injectable for tests; defaults to the global fetch. Lets the suite avoid
	// mutating `globalThis.fetch` (which would race other test files).
	fetchImpl?: typeof fetch;
}

// Raised for any fetch/validation failure. Callers map this to EXIT.USAGE and
// write nothing — fetched source is never executed, only validated and stamped.
export class RegistryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RegistryError";
	}
}

const PayloadSchema = z.object({
	entry: ComponentEntrySchema,
	templates: z.record(z.string(), z.string()),
});

// Every relative path an entry needs present in `templates`.
export function requiredTemplatePaths(entry: ComponentEntry): string[] {
	const out = entry.files.map((f) => f.from);
	for (const h of entry.internalHelpers) {
		out.push(`_internal/${INTERNAL_FILES[h]}`);
	}
	if (entry.tokens && entry.tokens.length > 0) out.push("tokens.css");
	return out;
}

export function parsePayload(raw: unknown): ComponentPayload {
	const parsed = PayloadSchema.safeParse(raw);
	if (!parsed.success) {
		throw new RegistryError(
			`registry payload failed validation: ${parsed.error.issues
				.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
				.join("; ")}`,
		);
	}
	const payload = parsed.data;
	for (const rel of requiredTemplatePaths(payload.entry)) {
		if (typeof payload.templates[rel] !== "string") {
			throw new RegistryError(
				`registry payload for "${payload.entry.name}" is missing inlined source for ${rel}`,
			);
		}
	}
	return payload;
}

// Join a registry base with a component name into its payload URL/path.
export function componentTarget(base: string, name: string): string {
	const trimmed = base.replace(/\/+$/, "");
	return `${trimmed}/${name}.json`;
}

function assertProtocol(url: URL, opts: FetchOptions): void {
	if (url.protocol === "https:") return;
	if (url.protocol === "http:") {
		if (opts.allowInsecure) return;
		throw new RegistryError(
			`refusing to fetch over http (${url.href}); pass --allow-insecure to override`,
		);
	}
	throw new RegistryError(`unsupported registry protocol: ${url.protocol}`);
}

export async function fetchPayload(
	target: string,
	opts: FetchOptions,
): Promise<ComponentPayload> {
	const url = new URL(target);
	assertProtocol(url, opts);
	const doFetch = opts.fetchImpl ?? fetch;
	let res: Response;
	try {
		res = await doFetch(url);
	} catch (err) {
		throw new RegistryError(
			`failed to fetch ${url.href}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
	if (!res.ok) {
		throw new RegistryError(`fetch ${url.href} returned HTTP ${res.status}`);
	}
	let raw: unknown;
	try {
		raw = await res.json();
	} catch {
		throw new RegistryError(`response from ${url.href} is not valid JSON`);
	}
	return parsePayload(raw);
}

export async function readPayloadFile(path: string): Promise<ComponentPayload> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new RegistryError(`registry payload not found: ${path}`);
	}
	let raw: unknown;
	try {
		raw = await file.json();
	} catch {
		throw new RegistryError(`registry payload is not valid JSON: ${path}`);
	}
	return parsePayload(raw);
}
