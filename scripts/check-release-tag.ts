#!/usr/bin/env bun
// Guards the npm `latest` dist-tag so it only ever points at a stable release.
//
// `changeset publish` tags whatever it publishes as `latest` UNLESS the repo is
// in changesets pre mode (`.changeset/pre.json` present), in which case it
// publishes under the configured pre tag (e.g. next/beta/rc) and leaves
// `latest` untouched.
//
// Therefore the invariant is: a public package may carry a prerelease version
// (a semver with a `-` prerelease identifier) ONLY while pre mode is active.
// A prerelease version outside pre mode would move `latest` onto a prerelease.
//
// Wired into `lint` (early signal on the PR) and run immediately before
// `changeset publish` in release.yml (last line of defence before npm).

export {};

const preJson = Bun.file(".changeset/pre.json");
const inPreMode = await preJson.exists();
const preTag = inPreMode
	? ((await preJson.json()) as { tag?: string }).tag
	: undefined;

const isPrerelease = (version: string) => version.includes("-");

const offenders: string[] = [];
const prereleases: string[] = [];

const glob = new Bun.Glob("packages/*/package.json");
for await (const file of glob.scan({ onlyFiles: true, absolute: false })) {
	const pkg = (await Bun.file(file).json()) as {
		name?: string;
		version?: string;
		private?: boolean;
	};
	if (pkg.private || !pkg.name || !pkg.version) continue;
	if (isPrerelease(pkg.version)) {
		const tag = `${pkg.name}@${pkg.version}`;
		prereleases.push(tag);
		if (!inPreMode) offenders.push(tag);
	}
}

if (offenders.length > 0) {
	console.error(
		"Refusing to publish: prerelease versions would be tagged `latest`.",
	);
	for (const o of offenders) console.error(`  ${o}`);
	console.error(
		"\nEnter changesets pre mode first so these publish under a pre tag:",
	);
	console.error("  bunx changeset pre enter next   # or beta / rc");
	process.exit(1);
}

if (inPreMode) {
	console.log(
		`Pre mode active (tag: ${preTag ?? "?"}). ${prereleases.length} prerelease version(s) will publish under \`${preTag}\`, not \`latest\`.`,
	);
} else {
	console.log(
		"Stable release: all public package versions are stable; `latest` is safe.",
	);
}
