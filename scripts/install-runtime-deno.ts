#!/usr/bin/env bun
// Downloads a pinned Deno release directly from GitHub releases and places
// the binary on $GITHUB_PATH. No npm. Linux x86_64 only.

import { appendFile, chmod, mkdir } from "node:fs/promises";

const VERSION = "v2.1.4";
const SHA256 = "REPLACE_WITH_PINNED_SHA256_ON_FIRST_RUN";
const url = `https://github.com/denoland/deno/releases/download/${VERSION}/deno-x86_64-unknown-linux-gnu.zip`;

const installDir = `${process.env.RUNNER_TOOL_CACHE ?? `${process.env.HOME}/.cache`}/deno/${VERSION}`;
await mkdir(installDir, { recursive: true });

console.log(`Downloading deno ${VERSION}...`);
const res = await fetch(url);
if (!res.ok) {
	console.error(`Download failed: ${res.status} ${res.statusText}`);
	process.exit(1);
}
const buf = new Uint8Array(await res.arrayBuffer());

const hasher = new Bun.CryptoHasher("sha256");
hasher.update(buf);
const digest = hasher.digest("hex");
if (SHA256 !== "REPLACE_WITH_PINNED_SHA256_ON_FIRST_RUN" && digest !== SHA256) {
	console.error(`SHA256 mismatch: got ${digest}, expected ${SHA256}`);
	process.exit(1);
}
console.log(`sha256: ${digest}`);

const zipPath = `${installDir}/deno.zip`;
await Bun.write(zipPath, buf);

const unzip = Bun.spawn(["unzip", "-o", zipPath, "-d", installDir]);
await unzip.exited;

const binPath = `${installDir}/deno`;
await chmod(binPath, 0o755);

if (process.env.GITHUB_PATH) {
	await appendFile(process.env.GITHUB_PATH, `${installDir}\n`);
}
console.log(`deno installed at ${binPath}`);
