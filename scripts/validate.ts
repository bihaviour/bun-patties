#!/usr/bin/env bun
// `bun run validate` gate with two output modes:
//   default     → compact checklist, one line per step with pass/fail + timing
//   --verbose   → stream every step's full output (lint, typecheck, test, knip),
//                 i.e. the old behaviour
//
// Each step shells out to its package.json script, so the definition of what a
// check runs stays in one place.

export {};

const verbose = process.argv.includes("--verbose");
const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string, s: string) =>
	color ? `\x1b[${code}m${s}\x1b[0m` : s;
const green = (s: string) => paint("32", s);
const red = (s: string) => paint("31", s);
const dim = (s: string) => paint("2", s);

const steps = ["lint", "typecheck", "test", "knip"] as const;

const summariseTests = (output: string): string => {
	let pass = 0;
	let fail = 0;
	for (const m of output.matchAll(/(\d+) pass\b/g)) pass += Number(m[1]);
	for (const m of output.matchAll(/(\d+) fail\b/g)) fail += Number(m[1]);
	if (pass === 0 && fail === 0) return "";
	return fail > 0 ? `${pass} pass, ${fail} fail` : `${pass} pass`;
};

const start = performance.now();

if (verbose) {
	for (const step of steps) {
		console.log(dim(`\n──── ${step} ────`));
		const proc = Bun.spawn(["bun", "run", step], {
			stdout: "inherit",
			stderr: "inherit",
		});
		const code = await proc.exited;
		if (code !== 0) {
			console.error(red(`\n✗ ${step} failed (exit ${code})`));
			process.exit(code);
		}
	}
	console.log(green("\n✓ all checks passed"));
	process.exit(0);
}

console.log(dim("validate — checklist (use --verbose for full output)\n"));

for (const step of steps) {
	const stepStart = performance.now();
	const proc = Bun.spawn(["bun", "run", step], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	const secs = ((performance.now() - stepStart) / 1000).toFixed(1);
	const note = step === "test" ? summariseTests(out + err) : "";

	if (code === 0) {
		console.log(
			`  ${green("✓")} ${step.padEnd(10)}${dim(`${secs}s`)}${note ? dim(`  ${note}`) : ""}`,
		);
	} else {
		console.log(`  ${red("✗")} ${step.padEnd(10)}${dim(`${secs}s`)}`);
		console.error(`\n${(out + err).trimEnd()}\n`);
		console.error(
			red(
				`✗ ${step} failed (exit ${code}) — re-run with --verbose for live output`,
			),
		);
		process.exit(code);
	}
}

const total = ((performance.now() - start) / 1000).toFixed(1);
console.log(`\n${green("✓ all checks passed")} ${dim(`(${total}s)`)}`);
