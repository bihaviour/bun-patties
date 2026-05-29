// Rewrite scattered `@radix-ui/react-*` imports to the unified `radix-ui`
// namespace import. Detection uses Bun's transpiler; the surgical edit is a
// scoped regex on import statements so user formatting/comments survive (a full
// Bun.Transpiler transform would reprint and destroy them).

export interface RewriteResult {
	output: string;
	changed: boolean;
	reports: string[];
}

const NS_IMPORT =
	/^[ \t]*import\s+\*\s+as\s+(\w+)\s+from\s+["']@radix-ui\/react-([\w-]+)["'];?[ \t]*\n?/gm;

const NAMED_IMPORT =
	/^[ \t]*import\s*\{[^}]*\}\s*from\s*["']@radix-ui\/react-[\w-]+["'];?[ \t]*$/gm;

function kebabToPascal(s: string): string {
	return s
		.split("-")
		.map((p) => (p ? p[0]?.toUpperCase() + p.slice(1) : ""))
		.join("");
}

// True if the file imports any scattered @radix-ui/react-* package.
export function hasScatteredRadix(source: string): boolean {
	return /["']@radix-ui\/react-[\w-]+["']/.test(source);
}

export function rewriteRadix(source: string): RewriteResult {
	if (!hasScatteredRadix(source)) {
		return { output: source, changed: false, reports: [] };
	}

	const reports: string[] = [];
	const specifiers: string[] = [];

	NS_IMPORT.lastIndex = 0;
	for (const m of source.matchAll(NS_IMPORT)) {
		const local = m[1] ?? "";
		const ns = kebabToPascal(m[2] ?? "");
		specifiers.push(ns === local ? ns : `${ns} as ${local}`);
	}

	// Named imports from a radix package have no 1:1 unified equivalent; report.
	NAMED_IMPORT.lastIndex = 0;
	for (const m of source.matchAll(NAMED_IMPORT)) {
		reports.push(`named import has no unified equivalent: ${m[0].trim()}`);
	}

	if (specifiers.length === 0) {
		// Only un-convertible forms present; nothing rewritten.
		return { output: source, changed: false, reports };
	}

	// Replace the first scattered import with the merged unified import and drop
	// the rest. Doing it in one pass keeps the merged import where the first one
	// was (offset-safe — no manual slicing of a mutated string).
	const merged = `import { ${specifiers.join(", ")} } from "radix-ui";\n`;
	let seen = 0;
	NS_IMPORT.lastIndex = 0;
	const finalOut = source.replace(NS_IMPORT, () =>
		seen++ === 0 ? merged : "",
	);

	return { output: finalOut, changed: finalOut !== source, reports };
}
