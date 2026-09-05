import { describe, expect, it } from "vitest"

import { modeFromSlug, projectFromLink, VIEW_SLUGS, viewUrl } from "@/lib/view-url"
import type { WorkMode } from "@/stores/use-ui-store"

/**
 * The slugs are a public surface the moment somebody sends one of these links,
 * so they get a test rather than a convention.
 */
describe("tab URLs", () => {
  const modes = Object.keys(VIEW_SLUGS) as WorkMode[]

  it("gives every mode a slug, and no two the same", () => {
    expect(new Set(Object.values(VIEW_SLUGS)).size).toBe(modes.length)
  })

  it("round-trips every mode", () => {
    for (const mode of modes) {
      expect(modeFromSlug(VIEW_SLUGS[mode])).toBe(mode)
    }
  })

  it("calls the theme tab what the product calls it", () => {
    // "Design" in the UI and /theme in the URL is the one name nobody uses.
    expect(VIEW_SLUGS.theme).toBe("design")
    expect(modeFromSlug("design")).toBe("theme")
  })

  it("ignores a slug it does not know rather than throwing", () => {
    expect(modeFromSlug("themes")).toBeNull()
    expect(modeFromSlug("")).toBeNull()
    expect(modeFromSlug(undefined)).toBeNull()
  })

  it("is case-insensitive, because links get capitalised in transit", () => {
    expect(modeFromSlug("Design")).toBe("theme")
  })

  it("carries the project when there is one", () => {
    expect(viewUrl("theme", "p_123")).toBe("/design?p=p_123")
    expect(viewUrl("theme", null)).toBe("/design")
    expect(viewUrl("web")).toBe("/web")
  })

  it("escapes an id rather than pasting it into the query", () => {
    expect(viewUrl("data", "a b&c")).toBe("/data?p=a%20b%26c")
  })
})

/**
 * `?p=` carries whichever id the link's author had, and every tool, skill and
 * MCP reply prints the remote one — so matching only local ids meant every
 * printed link opened the wrong project, silently.
 */
describe("the project in a link", () => {
  const local = (id: string) => id === "local-1"
  const remoteMap: Record<string, string> = { "remote-1": "local-1" }
  const localIdOf = (remoteId: string) => remoteMap[remoteId] ?? null

  it("takes a local id as it stands", () => {
    expect(projectFromLink("local-1", local, localIdOf)).toBe("local-1")
  })

  it("maps a remote id back to the local project it belongs to", () => {
    expect(projectFromLink("remote-1", local, localIdOf)).toBe("local-1")
  })

  it("gives up on an id from somebody else's machine rather than guessing", () => {
    expect(projectFromLink("remote-other", local, localIdOf)).toBeNull()
    expect(projectFromLink("", local, localIdOf)).toBeNull()
    expect(projectFromLink(null, local, localIdOf)).toBeNull()
  })
})
