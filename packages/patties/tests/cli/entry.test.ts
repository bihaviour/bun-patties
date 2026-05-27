import { expect, test } from "bun:test";
import { main } from "../../src/cli/index.ts";

test("--version prints version and exits 0", async () => {
	const code = await main(["--version"]);
	expect(code).toBe(0);
});

test("no args → help, exit 0", async () => {
	const code = await main([]);
	expect(code).toBe(0);
});

test("unknown command exits with 2", async () => {
	const code = await main(["frobnicate"]);
	expect(code).toBe(2);
});
