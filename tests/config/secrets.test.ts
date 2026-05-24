import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { loadSecrets } from "../../src/config/secrets.ts"
import { PattiesConfigSchema } from "../../src/config/schema.ts"

const originalEnv = { ...process.env }

beforeEach(() => {
  delete process.env.PATTIES_ENV
  delete process.env.NODE_ENV
  delete process.env.MY_SECRET
})

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k]
  Object.assign(process.env, originalEnv)
})

describe("loadSecrets", () => {
  test("production short-circuits", async () => {
    process.env.PATTIES_ENV = "production"
    const cfg = PattiesConfigSchema.parse({ secrets: ["MY_SECRET"] })
    await loadSecrets(cfg)
    expect(process.env.MY_SECRET).toBeUndefined()
  })

  test("dev with empty secrets list is a no-op", async () => {
    const cfg = PattiesConfigSchema.parse({})
    await expect(loadSecrets(cfg)).resolves.toBeUndefined()
  })

  test("dev never throws even when Bun.secrets backend is unavailable", async () => {
    const cfg = PattiesConfigSchema.parse({ secrets: ["MY_SECRET"] })
    await expect(loadSecrets(cfg)).resolves.toBeUndefined()
  })
})
