export const EXIT = {
	OK: 0,
	ERROR: 1,
	USAGE: 2,
	INTERRUPTED: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

let verbose = false;

export function setVerbose(value: boolean): void {
	verbose = value;
}

export function isVerbose(): boolean {
	return verbose;
}

export function isTTY(stream: NodeJS.WriteStream): boolean {
	return Boolean(stream?.isTTY);
}

function colorEnabled(stream: NodeJS.WriteStream): boolean {
	if (process.env.NO_COLOR) return false;
	return isTTY(stream);
}

const C = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
};

function paint(stream: NodeJS.WriteStream, code: string, msg: string): string {
	return colorEnabled(stream) ? `${code}${msg}${C.reset}` : msg;
}

export type Color = "green" | "yellow" | "red" | "dim" | "cyan";

// Single source of truth for the CLI palette, so `patties doctor` and any other
// formatted report tint with the same TTY/NO_COLOR-gated codes as `log`.
export function colorize(
	stream: NodeJS.WriteStream,
	color: Color,
	msg: string,
): string {
	return paint(stream, C[color], msg);
}

export const log = {
	info(msg: string): void {
		process.stdout.write(`${msg}\n`);
	},
	success(msg: string): void {
		process.stdout.write(`${paint(process.stdout, C.green, "✓")} ${msg}\n`);
	},
	warn(msg: string): void {
		process.stderr.write(`${paint(process.stderr, C.yellow, "⚠")} ${msg}\n`);
	},
	error(msg: string): void {
		process.stderr.write(`${paint(process.stderr, C.red, "✗")} ${msg}\n`);
	},
	dim(msg: string): void {
		process.stdout.write(`${paint(process.stdout, C.dim, msg)}\n`);
	},
	debug(msg: string): void {
		if (!verbose) return;
		process.stderr.write(`${paint(process.stderr, C.dim, msg)}\n`);
	},
};

// Ask a yes/no question on stderr and read one line from stdin. Returns false
// on EOF / non-affirmative input. Callers gate this on a TTY and an explicit
// `--yes` escape hatch (cli/15 show-before-stamp).
export async function confirm(question: string): Promise<boolean> {
	process.stderr.write(`${question} [y/N] `);
	const line = await new Promise<string>((resolveLine) => {
		const onData = (chunk: Buffer): void => {
			process.stdin.pause();
			process.stdin.off("data", onData);
			resolveLine(chunk.toString());
		};
		process.stdin.resume();
		process.stdin.on("data", onData);
	});
	return /^\s*y(es)?\s*$/i.test(line);
}

export interface FormatErrorInput {
	title: string;
	file?: string;
	line?: number;
	col?: number;
	reason?: string;
	tip?: string;
}

export function formatError(input: FormatErrorInput): string {
	const out: string[] = [];
	out.push(`${paint(process.stderr, C.red, "✗")} ${input.title}`);
	if (input.file) {
		const loc =
			input.line !== undefined
				? `${input.file}:${input.line}${input.col !== undefined ? `:${input.col}` : ""}`
				: input.file;
		out.push(`  File: ${loc}`);
	}
	if (input.reason) out.push(`  Reason: ${input.reason}`);
	if (input.tip) out.push(`  → Tip: ${input.tip}`);
	return out.join("\n");
}

export function printError(input: FormatErrorInput): void {
	process.stderr.write(`${formatError(input)}\n`);
}

export type SigintHandler = () => void | Promise<void>;

let sigintInstalled = false;

export function installSigintHandler(onSignal?: SigintHandler): void {
	if (sigintInstalled) return;
	sigintInstalled = true;
	process.on("SIGINT", async () => {
		try {
			if (onSignal) await onSignal();
		} finally {
			process.exit(EXIT.INTERRUPTED);
		}
	});
}
