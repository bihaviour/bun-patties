import { describe, expect, test } from "bun:test"
import { createServer } from "../src/server/index.ts"

describe("createServer", () => {
  test("returns { fetch, port } and dispatches a known route", async () => {
    const server = createServer({
      routes: {
        "/hello": {
          GET: ((_req: Request) => new Response("hi")) as never,
        } as unknown as never,
      },
      fallback: () => new Response("nope", { status: 404 }),
    })
    expect(server.port).toBe(3000)
    const res = await server.fetch(new Request("http://x/hello"))
    expect(await res.text()).toBe("hi")

    const miss = await server.fetch(new Request("http://x/other"))
    expect(miss.status).toBe(404)
  })

  test("validates mutually exclusive unix vs port", () => {
    expect(() =>
      createServer({
        unix: "/tmp/x.sock",
        port: 3000,
        routes: {},
        fallback: () => new Response("", { status: 404 }),
      }),
    ).toThrow(/mutually exclusive/)
  })

  test("does not import node:http or hono", async () => {
    const src = await Bun.file(import.meta.dir + "/../src/server/index.ts").text()
    expect(src).not.toMatch(/from\s+['"]node:http['"]/)
    expect(src).not.toMatch(/from\s+['"]hono['"]/)
  })
})
