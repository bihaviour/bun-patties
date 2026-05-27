import { z } from "zod";
import { defineTool } from "../../../../../src/ai/define.ts";

export default defineTool({
	name: "search",
	description: "Search hotel inventory.",
	input: z.object({
		city: z.string(),
		from: z.string(),
		to: z.string(),
	}),
	async handler(input) {
		return { city: input.city, results: [] };
	},
});
