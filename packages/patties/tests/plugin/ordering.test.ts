import { describe, expect, test } from "bun:test";
import { definePlugin } from "../../src/plugin/index.ts";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";

const FIXTURES = `${import.meta.dir}/../fixtures`;

describe("plugin ordering", () => {
	test("plugins run setup in declared order", async () => {
		const log: string[] = [];
		const mk = (name: string) =>
			definePlugin({
				name,
				setup() {
					log.push(name);
				},
			});
		const renderer = createRenderer({});
		await createRouter({
			appDir: `${FIXTURES}/basic-app/app`,
			renderer,
			plugins: [mk("a"), mk("b"), mk("c")],
		});
		expect(log).toEqual(["a", "b", "c"]);
	});
});
