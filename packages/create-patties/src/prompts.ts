// Interactive prompts for create-patties. See cli specs 09 + 18.
// Uses Bun's built-in prompt() — no new dependency.
//
// Non-TTY callers must supply the equivalent flags; the run loop only invokes
// these helpers when stdin is a TTY and --yes was not passed. The prompt order
// (spec 18) is gated by project type: UI is asked only for frontend/fullstack,
// monorepo only for fullstack, and the deploy target option set depends on type.

export type AgentTemplate = "claude" | "codex" | "none";
export type ProjectType = "frontend" | "backend" | "fullstack";
export type Target = "bun" | "edge" | "container";
export type Theme = "neutral" | "slate" | "stone" | "zinc";
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

// "old school" is the TTY label for the no-agent choice; the flag value stays
// `none` (spec 18). `--template` remains an alias for `--agent`.
export function promptAgent(io: PromptIO = {}): AgentTemplate {
	const ask = io.prompt ?? prompt;
	const answer = (
		ask(
			"Which coding agent are you using? [Claude/Codex/old school] (Claude) ",
		) ?? ""
	)
		.trim()
		.toLowerCase();
	if (answer === "codex") return "codex";
	if (answer === "none" || answer === "old school" || answer === "old-school") {
		return "none";
	}
	return "claude";
}

export function promptType(io: PromptIO = {}): ProjectType {
	const ask = io.prompt ?? prompt;
	const answer = (
		ask(
			"What kind of project are you building? [frontend/backend/fullstack] (fullstack) ",
		) ?? ""
	)
		.trim()
		.toLowerCase();
	if (answer === "frontend") return "frontend";
	if (answer === "backend") return "backend";
	return "fullstack";
}

// Asked only for frontend/fullstack — backend has no UI surface.
export function promptUi(io: PromptIO = {}): boolean {
	const ask = io.prompt ?? prompt;
	const answer = (
		ask("Do you want a styled UI template (Patties UI)? [Y/n] (Y) ") ?? ""
	)
		.trim()
		.toLowerCase();
	return !(answer === "n" || answer === "no");
}

// Asked only for fullstack.
export function promptMonorepo(io: PromptIO = {}): boolean {
	const ask = io.prompt ?? prompt;
	const answer = (ask("Do you want a monorepo structure? [y/N] (N) ") ?? "")
		.trim()
		.toLowerCase();
	return answer === "y" || answer === "yes";
}

// The option set depends on project type: container is fullstack-only.
export function promptTarget(type: ProjectType, io: PromptIO = {}): Target {
	const ask = io.prompt ?? prompt;
	const options = type === "fullstack" ? "bun/edge/container" : "bun/edge";
	const answer = (ask(`Where will you deploy? [${options}] (bun) `) ?? "")
		.trim()
		.toLowerCase();
	if (answer === "edge" || answer === "worker" || answer === "worker/edge") {
		return "edge";
	}
	if (
		type === "fullstack" &&
		(answer === "container" ||
			answer === "docker" ||
			answer === "container/docker")
	) {
		return "container";
	}
	return "bun";
}

export function promptDeploy(io: PromptIO = {}): Deploy {
	const ask = io.prompt ?? prompt;
	const answer = (
		ask("Deploy plugin? [cloudflare/vercel/deno/netlify/none] (none) ") ?? ""
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
