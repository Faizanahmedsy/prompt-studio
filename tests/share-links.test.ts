import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isTransientProject, TRANSIENT_PREFIX } from "@/features/cloud/read-only"
import {
  clearProjectRef,
  projectUrl,
  publicUrl,
  readProjectRef,
  stashProjectRef,
  takeProjectRef,
} from "@/lib/share-codec"

/**
 * Three link shapes, and they must not be confused for one another:
 *   #s=<payload>  a snapshot, opens as a copy
 *   #p=<id>       the live project, for people already added
 *   /v/<token>    public, read-only, no account
 */

const setLocation = (href: string) => {
  const url = new URL(href)
  vi.stubGlobal("window", {
    location: {
      href: url.href,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    },
    history: { replaceState: vi.fn() },
    sessionStorage: sessionStub,
  })
}

let store: Record<string, string> = {}
const sessionStub = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v
  },
  removeItem: (k: string) => {
    delete store[k]
  },
}

beforeEach(() => {
  store = {}
})
afterEach(() => vi.unstubAllGlobals())

describe("building the links", () => {
  it("a team link carries the server id in the hash", () => {
    setLocation("https://studio.example.test/")
    expect(projectUrl("abc-123")).toBe("https://studio.example.test/#p=abc-123")
  })

  it("a team link keeps the current path, so it works from a sub-route", () => {
    setLocation("https://studio.example.test/studio")
    expect(projectUrl("abc-123")).toBe("https://studio.example.test/studio#p=abc-123")
  })

  it("a public link is a real path, not a hash", () => {
    setLocation("https://studio.example.test/anything")
    expect(publicUrl("tok_abc")).toBe("https://studio.example.test/v/tok_abc")
  })

  it("a public token with URL-unsafe characters is escaped", () => {
    setLocation("https://studio.example.test/")
    expect(publicUrl("a/b c")).toBe("https://studio.example.test/v/a%2Fb%20c")
  })
})

describe("reading a team link", () => {
  it("finds the id", () => {
    setLocation("https://studio.example.test/#p=abc-123")
    expect(readProjectRef()).toBe("abc-123")
  })

  it("ignores a snapshot link — they are different things", () => {
    setLocation("https://studio.example.test/#s=v1.payload")
    expect(readProjectRef()).toBeNull()
  })

  it("ignores an empty reference rather than returning a blank id", () => {
    setLocation("https://studio.example.test/#p=")
    expect(readProjectRef()).toBeNull()
  })

  it("is silent on a plain URL", () => {
    setLocation("https://studio.example.test/")
    expect(readProjectRef()).toBeNull()
  })
})

describe("surviving the sign-in redirect", () => {
  it("stashes the id so the redirect to /login cannot lose it", () => {
    setLocation("https://studio.example.test/#p=abc-123")
    stashProjectRef()
    // The router has now replaced the URL and the hash is gone.
    setLocation("https://studio.example.test/")
    expect(takeProjectRef()).toBe("abc-123")
  })

  it("hands the id back exactly once", () => {
    setLocation("https://studio.example.test/#p=abc-123")
    stashProjectRef()
    setLocation("https://studio.example.test/")
    expect(takeProjectRef()).toBe("abc-123")
    expect(takeProjectRef()).toBeNull()
  })

  it("prefers the live hash over a stale stash", () => {
    setLocation("https://studio.example.test/#p=old")
    stashProjectRef()
    setLocation("https://studio.example.test/#p=new")
    expect(takeProjectRef()).toBe("new")
    // ...and the stale one does not resurface afterwards.
    setLocation("https://studio.example.test/")
    expect(takeProjectRef()).toBeNull()
  })

  it("stashes nothing when there is no reference", () => {
    setLocation("https://studio.example.test/")
    stashProjectRef()
    expect(takeProjectRef()).toBeNull()
  })

  it("does not throw when storage is unavailable", () => {
    setLocation("https://studio.example.test/#p=abc")
    vi.stubGlobal("window", {
      location: new URL("https://studio.example.test/#p=abc"),
      sessionStorage: {
        getItem: () => {
          throw new Error("blocked")
        },
        setItem: () => {
          throw new Error("blocked")
        },
        removeItem: () => {
          throw new Error("blocked")
        },
      },
    })
    expect(() => stashProjectRef()).not.toThrow()
    expect(() => takeProjectRef()).not.toThrow()
  })

  it("clears the reference from the address bar", () => {
    setLocation("https://studio.example.test/#p=abc-123")
    const replaceState = window.history.replaceState as ReturnType<typeof vi.fn>
    clearProjectRef()
    expect(replaceState).toHaveBeenCalled()
  })
})

describe("a public view never becomes the viewer's own project", () => {
  it("recognises a transient id", () => {
    expect(isTransientProject(`${TRANSIENT_PREFIX}abc`)).toBe(true)
  })

  it("does not mistake a normal project for one", () => {
    expect(isTransientProject("prj_abc")).toBe(false)
  })
})
