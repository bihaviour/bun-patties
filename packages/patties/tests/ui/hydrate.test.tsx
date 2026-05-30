import { afterAll, describe, expect, test } from "bun:test";
import { Hello } from "./__fixtures__/hello-island.tsx";
import { hydrate, teardownDom } from "./helpers/hydrate.ts";

afterAll(async () => {
	await teardownDom();
});

describe("hydrate", () => {
	test("round-trips the fixture without console errors", async () => {
		const { errors, html, textContent } = await hydrate(
			<Hello name="hydration" />,
		);
		expect(html).toContain("Hello, hydration!");
		expect(textContent).toContain("Hello, hydration!");
		expect(errors).toEqual([]);
	});
});
