import { describe, expect, test } from "bun:test"
import {
  validateNamedModules,
  validateAgentToolReferences,
  validateJobs,
} from "../../src/ai/validate.ts"

describe("validate", () => {
  test("collects all name mismatches before throwing", () => {
    expect(() =>
      validateNamedModules("agent", [
        { expectedName: "a", filePath: "/x/a.ts", config: { name: "wrong-a" } },
        { expectedName: "b", filePath: "/x/b.ts", config: { name: "wrong-b" } },
      ]),
    ).toThrow(/wrong-a[\s\S]*wrong-b/)
  })

  test("flags duplicates", () => {
    expect(() =>
      validateNamedModules("tool", [
        { expectedName: "t", filePath: "/x/t.ts", config: { name: "t" } },
        { expectedName: "t", filePath: "/y/t.ts", config: { name: "t" } },
      ]),
    ).toThrow(/Duplicate tool name "t"/)
  })

  test("agent referencing unknown tool fails", () => {
    expect(() =>
      validateAgentToolReferences(
        [{ expectedName: "a", filePath: "/x/a.ts", config: { name: "a", model: "m", tools: ["missing"] } }],
        [],
      ),
    ).toThrow(/unknown tool "missing"/)
  })

  test("job missing tz fails", () => {
    expect(() =>
      validateJobs([
        {
          expectedName: "j",
          filePath: "/x/j.ts",
          config: { name: "j", schedule: "* * * * *", tz: "", handler: () => {} },
        },
      ]),
    ).toThrow(/missing required "tz"/)
  })
})
