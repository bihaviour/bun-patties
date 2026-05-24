import { test, expect, describe } from "bun:test"
import { dispatch, makeMatcher } from "../../src/router/match.ts"
import type { BunRoutes } from "../../src/types.ts"

describe("makeMatcher", () => {
  test("static segments", () => {
    const m = makeMatcher("/users")
    expect(m("/users")).toEqual({})
    expect(m("/users/")).toEqual({})
    expect(m("/other")).toBeNull()
  })

  test(":param captures and decodes", () => {
    const m = makeMatcher("/users/:id")
    expect(m("/users/42")).toEqual({ id: "42" })
    expect(m("/users/hello%20world")).toEqual({ id: "hello world" })
    expect(m("/users")).toBeNull()
    expect(m("/users/42/extra")).toBeNull()
  })

  test("* catch-all", () => {
    const m = makeMatcher("/files/*")
    expect(m("/files/a/b/c")).toEqual({ "*": "a/b/c" })
    expect(m("/files/")).toEqual({ "*": "" })
    expect(m("/other")).toBeNull()
  })
})

describe("dispatch", () => {
  const routes: BunRoutes = {
    "/": (() => new Response("root")) as never,
    "/users/:id": (((req: Request & { params: Record<string, string> }) =>
      new Response(`user ${req.params.id}`)) as unknown) as never,
    "/api": ({
      GET: () => new Response("get"),
      POST: () => new Response("post", { status: 201 }),
    }) as never,
  }

  test("function handler called with params", async () => {
    const res = await dispatch(routes, new Request("http://x/users/9"))
    expect(res).not.toBeNull()
    expect(await res!.text()).toBe("user 9")
  })

  test("method map dispatches", async () => {
    const res = await dispatch(routes, new Request("http://x/api", { method: "POST" }))
    expect(res!.status).toBe(201)
    expect(await res!.text()).toBe("post")
  })

  test("method miss → 405", async () => {
    const res = await dispatch(routes, new Request("http://x/api", { method: "DELETE" }))
    expect(res!.status).toBe(405)
  })

  test("no match → null", async () => {
    const res = await dispatch(routes, new Request("http://x/nope"))
    expect(res).toBeNull()
  })

  test("forwards env and execCtx through request augmentation", async () => {
    let seenEnv: unknown
    let seenExec: unknown
    const r: BunRoutes = {
      "/": (((req: Request & { params: Record<string, string>; env: unknown; execCtx: unknown }) => {
        seenEnv = req.env
        seenExec = req.execCtx
        return new Response("ok")
      }) as unknown) as never,
    }
    await dispatch(r, new Request("http://x/"), { env: { K: "V" }, execCtx: { waitUntil: () => {} } })
    expect(seenEnv).toEqual({ K: "V" })
    expect((seenExec as { waitUntil: unknown }).waitUntil).toBeInstanceOf(Function)
  })
})
