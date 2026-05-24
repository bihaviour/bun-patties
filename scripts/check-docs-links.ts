#!/usr/bin/env bun
import { stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

const roots = ["docs", "agent_specs"];
const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const broken: string[] = [];
let scanned = 0;

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

for (const root of roots) {
	if (!(await exists(root))) continue;
	const glob = new Bun.Glob("**/*.md");
	for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
		const filePath = `${root}/${rel}`;
		const contents = await Bun.file(filePath).text();
		scanned++;

		for (const match of contents.matchAll(linkRe)) {
			const target = match[1];
			if (!target) continue;
			if (
				target.startsWith("http://") ||
				target.startsWith("https://") ||
				target.startsWith("mailto:") ||
				target.startsWith("#") ||
				target.startsWith("data:")
			) {
				continue;
			}
			const [path] = target.split("#");
			if (!path) continue;
			const absRef = isAbsolute(path)
				? resolve(process.cwd(), path.slice(1))
				: resolve(dirname(filePath), path);
			if (await exists(absRef)) continue;
			broken.push(`${filePath}: -> ${target}`);
		}
	}
}

console.log(`Scanned ${scanned} markdown files.`);
if (broken.length > 0) {
	console.error(`Broken links (${broken.length}):`);
	for (const b of broken) console.error(`  ${b}`);
	process.exit(1);
}
console.log("All relative links resolve.");
