// Interactive prompts for create-patties. See spec cli/09-create-patties-dx
// items 3 + 5. Uses Bun's built-in prompt() — no new dependency.
//
// Non-TTY callers must supply the equivalent flags; the run loop only invokes
// these helpers when stdin is a TTY and --yes was not passed.

export type AgentTemplate = "claude" | "codex" | "none";
export type Target = "bun" | "edge";
export type Deploy =
	| "cloudflare"
	| "vercel"
	| "deno"
	| "netlify"
	| "bun"
	| "none";

export interface PromptIO {
	prompt?: (q: string) => string | null;
	stdout?: (msg: string) => void;
	isTTY?: boolean;
}

const DEFAULT_NAME = "my-patties-app";

export function isInteractive(io: PromptIO = {}): boolean {
	if (io.isTTY !== undefined) return io.isTTY;
	return Boolean(process.stdin.isTTY);
}

export function promptName(
	current: string | undefined,
	isValid: (name: string) => boolean,
	io: PromptIO = {},
): string | undefined {
	if (current) return current;
	const ask = io.prompt ?? prompt;
	const out = io.stdout ?? ((m: string) => process.stdout.write(m));

	for (let attempt = 0; attempt < 5; attempt++) {
		const answer = (ask(`Project name: (${DEFAULT_NAME}) `) ?? "").trim();
		const candidate = answer === "" ? DEFAULT_NAME : answer;
		if (isValid(candidate)) return candidate;
		out(
			`✗ invalid project name: "${candidate}" — use lowercase letters, digits, _ or -\n`,
		);
	}
	return undefined;
}

export function promptAgent(io: PromptIO = {}): AgentTemplate {
	const ask = io.prompt ?? prompt;
	const answer = (
		ask("Which AI coding agent will you use? [claude/codex/none] (claude) ") ??
		""
	)
		.trim()
		.toLowerCase();
	if (answer === "codex") return "codex";
	if (answer === "none") return "none";
	return "claude";
}

export function promptTarget(io: PromptIO = {}): Target {
	const ask = io.prompt ?? prompt;
	const answer = (ask("Runtime target? [bun/edge] (bun) ") ?? "")
		.trim()
		.toLowerCase();
	return answer === "edge" ? "edge" : "bun";
}

export function promptDeploy(io: PromptIO = {}): Deploy {
	const ask = io.prompt ?? prompt;
	const answer = (
		ask("Deploy plugin? [cloudflare/vercel/deno/netlify/bun/none] (none) ") ??
		""
	)
		.trim()
		.toLowerCase();
	const valid: Deploy[] = [
		"cloudflare",
		"vercel",
		"deno",
		"netlify",
		"bun",
		"none",
	];
	return (valid as string[]).includes(answer) ? (answer as Deploy) : "none";
}
