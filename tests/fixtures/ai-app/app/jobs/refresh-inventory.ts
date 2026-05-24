import { defineJob } from "../../../../../src/ai/define.ts";

export default defineJob({
	name: "refresh-inventory",
	schedule: "*/15 * * * *",
	tz: "Asia/Makassar",
	async handler() {
		// noop
	},
});
