#!/usr/bin/env bun
import { appendFile } from "node:fs/promises";

const eventName = process.env.GITHUB_EVENT_NAME ?? "push";
const baseRef = process.env.GITHUB_BASE_REF ?? "";
const outputFile = process.env.GITHUB_OUTPUT;

const range =
	eventName === "pull_request" && baseRef
		? `origin/${baseRef}...HEAD`
		: "HEAD^...HEAD";

const proc = Bun.spawn(["git", "diff", "--name-only", range], {
	stdout: "pipe",
	stderr: "pipe",
});
const text = await new Response(proc.stdout).text();
await proc.exited;

const files = text
	.split("\n")
	.map((l) => l.trim())
	.filter(Boolean);

const isDocsPath = (p: string): boolean => {
	if (p.startsWith("docs/")) return true;
	if (p.startsWith(".github/ISSUE_TEMPLATE/")) return true;
	if (!p.includes("/") && p.endsWith(".md")) return true;
	return false;
};

const adapterPrefixes = ["src/adapters/", "src/build/", "src/server/"];
const isAdapterTouched = (p: string): boolean => {
	if (adapterPrefixes.some((pre) => p.startsWith(pre))) return true;
	if (p.startsWith("tests/fixtures/edge-smoke/")) return true;
	if (p.startsWith("tests/adapters/")) return true;
	return false;
};

const isPluginTouched = (p: string): boolean =>
	p.startsWith("src/plugin/") || p.startsWith("plugins/");

const docsOnly = files.length > 0 && files.every(isDocsPath);
const adaptersTouched = files.some(isAdapterTouched);
const pluginsTouched = files.some(isPluginTouched);

const lines = [
	`docs-only=${docsOnly}`,
	`adapters-touched=${adaptersTouched}`,
	`plugins-touched=${pluginsTouched}`,
];

for (const line of lines) console.log(line);

if (outputFile) {
	await appendFile(outputFile, `${lines.join("\n")}\n`);
}
