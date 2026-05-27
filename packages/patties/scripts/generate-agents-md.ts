#!/usr/bin/env bun
// Regenerates the framework workspace's agent manifest from the canonical
// ai-app fixture. CI runs this followed by `git diff --exit-code` against the
// committed file to enforce freshness. See spec 16 §"check-agents-md" and
// spec 11.
//
// This workspace standardizes on Claude, so the manifest lands in CLAUDE.md.
// User projects pick their own target via `config.agentsMd.path`.

import { join } from "node:path";
import { generateAgentsMd } from "../src/agents-md/index.ts";

const appDir = join(
	import.meta.dir,
	"..",
	"tests",
	"fixtures",
	"ai-app",
	"app",
);
const outPath = join(import.meta.dir, "..", "CLAUDE.md");

const markdown = await generateAgentsMd(appDir);
await Bun.write(outPath, markdown);
console.log(`Wrote ${outPath} (${markdown.length} bytes)`);
