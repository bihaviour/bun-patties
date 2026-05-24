import { test, expect, describe } from "bun:test"
import { validateRequiredEnv, MissingEnv, getEnv } from "../../src/config/env.ts"

describe("validateRequiredEnv", () => {
  test("collects every missing name into a single MissingEnv", () => {
    let caught: unknown
    try {
      validateRequiredEnv(["A", "B"], {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(MissingEnv)
    if (caught instanceof MissingEnv) {
      expect(caught.names).toEqual(["A", "B"])
      expect(caught.message).toContain("A")
      expect(caught.message).toContain("B")
    }
  })

  test("returns silently when all required are present", () => {
    expect(() => validateRequiredEnv(["A"], { A: "x" })).not.toThrow()
  })

  test("treats empty string as missing", () => {
    expect(() => validateRequiredEnv(["A"], { A: "" })).toThrow(MissingEnv)
  })
})

describe("getEnv", () => {
  test("reads from supplied source", () => {
    expect(getEnv("X", { X: "1" })).toBe("1")
  })
  test("empty string → undefined", () => {
    expect(getEnv("X", { X: "" })).toBeUndefined()
  })
})
