import { describe, expect, test } from "bun:test";
import { classifySource } from "../../src/cli/commands/add/source.ts";

describe("classifySource", () => {
	test("a bare name is a catalog name", () => {
		expect(classifySource("button")).toEqual({ kind: "name", name: "button" });
	});

	test("an https url is a url", () => {
		expect(classifySource("https://r.acme.dev/card.json")).toEqual({
			kind: "url",
			url: "https://r.acme.dev/card.json",
		});
	});

	test("an http url is still a url (protocol checked later)", () => {
		expect(classifySource("http://insecure/x.json").kind).toBe("url");
	});

	test("@ns/name is namespaced", () => {
		expect(classifySource("@acme/fancy-button")).toEqual({
			kind: "namespaced",
			ns: "@acme",
			name: "fancy-button",
		});
	});

	test("a relative path is local", () => {
		expect(classifySource("./vendor/card.tsx")).toEqual({
			kind: "local",
			path: "./vendor/card.tsx",
		});
	});

	test("a bare filename with an extension is local", () => {
		expect(classifySource("card.tsx").kind).toBe("local");
		expect(classifySource("payload.json").kind).toBe("local");
	});

	test("a lone @ with no slash is treated as a name", () => {
		expect(classifySource("@scopeonly").kind).toBe("name");
	});
});
