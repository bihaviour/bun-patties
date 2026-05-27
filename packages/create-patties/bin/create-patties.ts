#!/usr/bin/env bun
if (typeof Bun === "undefined") {
	console.error(
		"create-patties requires Bun. Install Bun first: https://bun.sh",
	);
	process.exit(1);
}

const { run } = await import("../src/index.ts");
const code = await run(process.argv.slice(2));
process.exit(code);
