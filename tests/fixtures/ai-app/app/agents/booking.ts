import { defineAgent } from "../../../../../src/ai/define.ts";

export default defineAgent({
	name: "booking",
	model: "claude-sonnet-4-6",
	tools: ["search"],
	systemPrompt: "You are a booking agent.",
	triggers: ["POST /api/booking/chat"],
});
