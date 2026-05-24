import { describe, expect, test } from "bun:test"
import { compose, makeContext, defineMiddleware, type Middleware } from "../src/middleware/index.ts"
import { createRouter } from "../src/router/index.ts"
import { createServer } from "../src/server/index.ts"
import { createRenderer } from "../src/render/index.tsx"

const FIXTURES = import.meta.dir + "/fixtures"

describe("compose", () => {
  test("runs middleware in order then handler", async () => {
    const log: string[] = []
    const m1: Middleware = async (_r, _c, next) => {
      log.push("a-in")
      const r = await next()
      log.push("a-out")
      return r
    }
    const m2: Middleware = async (_r, _c, next) => {
      log.push("b-in")
      const r = await next()
      log.push("b-out")
      return r
    }
    const h = (_r: Request) => new Response("hi")
    const composed = compose([m1, m2], h)
    const res = await composed(new Request("http://x/"), makeContext(new Request("http://x/")))
    expect(await res.text()).toBe("hi")
    expect(log).toEqual(["a-in", "b-in", "b-out", "a-out"])
  })

  test("identity defineMiddleware", () => {
    const m: Middleware = async (_r, _c, next) => next()
    expect(defineMiddleware(m)).toBe(m)
  })
})

describe("router middleware loading", () => {
  test("fires once per request including 404", async () => {
    const mod = (await import(FIXTURES + "/basic-app/app/middleware.ts")) as {
      __resetCount: () => void
      __getCount: () => number
    }
    mod.__resetCount()

    const renderer = createRenderer({})
    const { routes, fallback } = await createRouter({
      appDir: FIXTURES + "/basic-app/app",
      renderer,
    })
    const server = createServer({ routes, fallback })

    await server.fetch(new Request("http://localhost/"))
    await server.fetch(new Request("http://localhost/api/revenue"))
    await server.fetch(new Request("http://localhost/does-not-exist"))

    expect(mod.__getCount()).toBe(3)
  })

  test("missing middleware.ts boots silently", async () => {
    const renderer = createRenderer({})
    const compiled = await createRouter({
      appDir: FIXTURES + "/no-middleware-app/app",
      renderer,
    })
    expect(compiled.entries.length).toBeGreaterThan(0)
  })

  test("non-function default export throws with file path", async () => {
    const renderer = createRenderer({})
    let err: Error | null = null
    try {
      await createRouter({ appDir: FIXTURES + "/bad-middleware-app/app", renderer })
    } catch (e) {
      err = e as Error
    }
    expect(err).not.toBeNull()
    expect(err!.message).toContain("middleware.ts")
  })
})
