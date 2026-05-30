#!/usr/bin/env bun
// Scans .github/**/*.{yml,yaml} for `uses:` references and fails if any
// reference is not pinned to a 40-character commit SHA. Local composite
// actions (`uses: ./...`) are allowed.

export {};

const usesRe = /^\s*-?\s*uses:\s*([^\s#]+)/gm;
const sha40 = /^[0-9a-f]{40}$/;

const violations: string[] = [];

const glob = new Bun.Glob("**/*.{yml,yaml}");
for await (const rel of glob.scan({
	cwd: ".github",
	onlyFiles: true,
	absolute: false,
})) {
	const file = `.github/${rel}`;
	const contents = await Bun.file(file).text();
	let match: RegExpExecArray | null;
	usesRe.lastIndex = 0;
	match = usesRe.exec(contents);
	while (match !== null) {
		const ref = match[1];
		if (ref && !ref.startsWith("./")) {
			const at = ref.lastIndexOf("@");
			if (at < 0) {
				violations.push(`${file}: missing @ref in '${ref}'`);
			} else {
				const pinned = ref.slice(at + 1);
				if (!sha40.test(pinned)) {
					violations.push(`${file}: '${ref}' is not pinned to a 40-char SHA`);
				}
			}
		}
		match = usesRe.exec(contents);
	}
}

if (violations.length > 0) {
	console.error(`Workflow pin violations (${violations.length}):`);
	for (const v of violations) console.error(`  ${v}`);
	process.exit(1);
}
console.log("All workflow `uses:` references are pinned to commit SHAs.");
