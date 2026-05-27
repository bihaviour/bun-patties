import { describe, expect, test } from "bun:test";
import { Hello } from "./__fixtures__/hello-island.tsx";
import { renderStatic } from "./helpers/render-static.ts";

describe("renderStatic", () => {
	test("returns SSR HTML string for a static component", async () => {
		const html = await renderStatic(<Hello name="Patties" />);
		expect(html).toContain("Hello, Patties!");
		expect(html).toContain('data-testid="hello"');
	});

	test("default props render", async () => {
		const html = await renderStatic(<Hello />);
		expect(html).toContain("Hello, world!");
	});
});
