#!/usr/bin/env bun
// Regenerates AGENTS.md from the canonical ai-app fixture. CI runs this
// followed by `git diff --exit-code AGENTS.md` to enforce that the committed
// file is fresh. See spec 16 §"check-agents-md" and spec 11.

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
const outPath = join(import.meta.dir, "..", "AGENTS.md");

const markdown = await generateAgentsMd(appDir);
await Bun.write(outPath, markdown);
console.log(`Wrote ${outPath} (${markdown.length} bytes)`);
