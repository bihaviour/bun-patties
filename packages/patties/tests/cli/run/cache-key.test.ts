import { describe, expect, test } from "bun:test";
import {
	canonicalSerialize,
	firstDifferingComponent,
	type KeyComponents,
	sha256Hex,
} from "../../../src/cli/run/cache-key.ts";

// The key is `sha256(canonicalSerialize(components))`, so its sensitivity to each
// of the nine components is exactly testable at the serialization boundary:
// flip one field, the digest must change. (computeKey wiring of real inputs is
// exercised end-to-end in run.test.ts.)
function keyOf(components: KeyComponents): string {
	return sha256Hex(canonicalSerialize(components));
}

const BASE: KeyComponents = {
	cacheFormatVersion: 1,
	task: { name: "build", command: "tsc" },
	inputsHash: "aaa",
	externalDeps: { lockHash: "lock1", direct: { zod: "^3.0.0" } },
	internalDepKeys: { shared: "depkey1" },
	globalInputs: { rootConfig: "cfg1", rootTsconfig: "ts1", packageJson: "pj1" },
	envValues: { NODE_ENV: "production" },
	toolVersions: { bun: "1.3.14", patties: "0.0.12" },
	platform: { platform: "darwin", arch: "arm64" },
};

const MUTATIONS: Array<[keyof KeyComponents, KeyComponents]> = [
	["cacheFormatVersion", { ...BASE, cacheFormatVersion: 2 }],
	["task", { ...BASE, task: { name: "build", command: "tsc --strict" } }],
	["inputsHash", { ...BASE, inputsHash: "bbb" }],
	[
		"externalDeps",
		{ ...BASE, externalDeps: { lockHash: "lock2", direct: { zod: "^3.0.0" } } },
	],
	["internalDepKeys", { ...BASE, internalDepKeys: { shared: "depkey2" } }],
	[
		"globalInputs",
		{
			...BASE,
			globalInputs: {
				rootConfig: "cfg2",
				rootTsconfig: "ts1",
				packageJson: "pj1",
			},
		},
	],
	["envValues", { ...BASE, envValues: { NODE_ENV: "development" } }],
	[
		"toolVersions",
		{ ...BASE, toolVersions: { bun: "1.3.15", patties: "0.0.12" } },
	],
	["platform", { ...BASE, platform: { platform: "linux", arch: "arm64" } }],
];

describe("cache key", () => {
	test("is deterministic for identical components", () => {
		expect(keyOf(BASE)).toBe(keyOf({ ...BASE }));
	});

	test("is insensitive to object key order (canonical serialize)", () => {
		const reordered: KeyComponents = {
			platform: { arch: "arm64", platform: "darwin" },
			toolVersions: { patties: "0.0.12", bun: "1.3.14" },
			envValues: { NODE_ENV: "production" },
			globalInputs: {
				packageJson: "pj1",
				rootTsconfig: "ts1",
				rootConfig: "cfg1",
			},
			internalDepKeys: { shared: "depkey1" },
			externalDeps: { direct: { zod: "^3.0.0" }, lockHash: "lock1" },
			inputsHash: "aaa",
			task: { command: "tsc", name: "build" },
			cacheFormatVersion: 1,
		};
		expect(keyOf(reordered)).toBe(keyOf(BASE));
	});

	for (const [component, mutated] of MUTATIONS) {
		test(`changes when ${component} changes`, () => {
			expect(keyOf(mutated)).not.toBe(keyOf(BASE));
			expect(firstDifferingComponent(mutated, BASE)).toBe(component);
		});
	}
});
