import { defineAgent } from "../../../../../src/ai/define.ts";

export default defineAgent({
	name: "concierge",
	model: "claude-sonnet-4-6",
	systemPrompt: "Hotel concierge.",
});
