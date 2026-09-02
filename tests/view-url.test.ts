import { describe, expect, it } from "vitest"

import { modeFromSlug, VIEW_SLUGS, viewUrl } from "@/lib/view-url"
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
