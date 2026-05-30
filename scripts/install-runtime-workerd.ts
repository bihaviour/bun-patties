#!/usr/bin/env bun
// Downloads a pinned workerd release directly from GitHub releases and places
// the binary on $GITHUB_PATH. No npm. Linux x86_64 only — adjust if/when CI
// matrix grows.

import { appendFile, chmod, mkdir } from "node:fs/promises";

const VERSION = "v1.20250408.0";
const SHA256 = "REPLACE_WITH_PINNED_SHA256_ON_FIRST_RUN";
const url = `https://github.com/cloudflare/workerd/releases/download/${VERSION}/workerd-linux-64.gz`;

const installDir = `${process.env.RUNNER_TOOL_CACHE ?? `${process.env.HOME}/.cache`}/workerd/${VERSION}`;
await mkdir(installDir, { recursive: true });

console.log(`Downloading workerd ${VERSION}...`);
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

const gzPath = `${installDir}/workerd.gz`;
await Bun.write(gzPath, buf);

const gunzip = Bun.spawn(["gunzip", "-f", gzPath]);
await gunzip.exited;

const binPath = `${installDir}/workerd`;
await chmod(binPath, 0o755);

if (process.env.GITHUB_PATH) {
	await appendFile(process.env.GITHUB_PATH, `${installDir}\n`);
}
console.log(`workerd installed at ${binPath}`);
