import { describe, expect, it } from "vitest"

import {
  libraryPrompts,
  promptById,
  promptCategories,
  searchPrompts,
} from "@/features/prompt-library/data/prompts"
import { modeFromSlug, VIEW_SLUGS } from "@/lib/view-url"

/**
 * The library ships prompts, not components — so the tests that matter are
 * about the text. A prompt with a placeholder nobody filled in, or a body
 * short enough to be a summary of a prompt rather than a prompt, is the
 * failure this file exists to catch.
 */
describe("the library holds usable prompts", () => {
  it("has a tab of its own in the URL", () => {
    expect(VIEW_SLUGS.prompts).toBe("prompts")
    expect(modeFromSlug("prompts")).toBe("prompts")
  })

  it("gives every prompt a unique id", () => {
    const ids = libraryPrompts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(promptById.size).toBe(libraryPrompts.length)
  })

  it("only uses categories the filter offers", () => {
    for (const prompt of libraryPrompts) {
      expect(promptCategories).toContain(prompt.category)
    }
  })

  it("fills every category", () => {
    for (const category of promptCategories) {
      expect(
        libraryPrompts.some((p) => p.category === category),
        `no prompt in ${category}`
      ).toBe(true)
    }
  })

  it.each(libraryPrompts.map((p) => [p.id, p] as const))(
    "%s is a whole prompt, not a summary",
    (_id, prompt) => {
      expect(prompt.title.length).toBeGreaterThan(3)
      expect(prompt.blurb.length).toBeGreaterThan(20)
      expect(prompt.howToUse.length).toBeGreaterThan(20)
      expect(prompt.tags.length).toBeGreaterThan(2)
      expect(prompt.body.length).toBeGreaterThan(600)
      // Every tag is lowercase, so search never misses on case.
      for (const tag of prompt.tags) expect(tag).toBe(tag.toLowerCase())
    }
  )

  it("marks the slot the reader has to fill in", () => {
    for (const prompt of libraryPrompts) {
      expect(
        /^\[.+\]$/m.test(prompt.body),
        `${prompt.id} has no bracketed slot on its own line`
      ).toBe(true)
    }
  })

  it("leaves no unbalanced bold markers", () => {
    for (const prompt of libraryPrompts) {
      const marks = prompt.body.match(/\*\*/g)?.length ?? 0
      expect(marks % 2, `${prompt.id} has an unclosed **`).toBe(0)
    }
  })
})

describe("the design prompts carry the tested principles", () => {
  const design = libraryPrompts.filter((p) => p.category === "Design")
  const shared = promptById.get("instrument-ui")

  it("keeps the flagship first in the list", () => {
    expect(libraryPrompts[0].id).toBe("instrument-ui")
  })

  it("offers a dark ground, a light ground, and the principles alone", () => {
    for (const id of ["instrument-ui", "dark-console", "light-saas"]) {
      expect(design.some((p) => p.id === id), `${id} missing`).toBe(true)
    }
  })

  it.each([
    ["one accent", /exactly one accent/i],
    ["placeholder ban", /Never ship placeholder content/],
    ["monospace as machine voice", /machine says/],
    ["uneven grid", /uneven grid/i],
    ["a working hero", /hero shows the product working/i],
    ["one motion idea", /one signature move/i],
    ["the inversion", /opposite ground/i],
    ["a self-check", /Before you finish/],
  ])("states the %s principle", (_name, pattern) => {
    expect(shared?.body).toMatch(pattern)
  })

  it("names the generic signatures it is steering away from", () => {
    for (const banned of [
      /centred hero/i,
      /identical feature cards/i,
      /gradient/i,
      /Emoji as icons/i,
    ]) {
      expect(shared?.body).toMatch(banned)
    }
  })

  it("carries the principles into both flavour prompts rather than restating them loosely", () => {
    const dark = promptById.get("dark-console")?.body ?? ""
    const light = promptById.get("light-saas")?.body ?? ""
    // Both are the shared brief plus a ground, so the brief must be intact in
    // each — a flavour prompt that drifted from it is the bug here.
    expect(dark).toContain("## The one idea")
    expect(light).toContain("## The one idea")
    expect(dark).toMatch(/near-black/i)
    expect(light).toMatch(/White for the page/i)
  })
})

describe("search", () => {
  it("finds a prompt by a word in its body, not only its title", () => {
    const hits = searchPrompts(libraryPrompts, "sparkline")
    expect(hits.length).toBeGreaterThan(0)
  })

  it("requires every word, so two words narrow rather than widen", () => {
    const one = searchPrompts(libraryPrompts, "design")
    const two = searchPrompts(libraryPrompts, "design terminal")
    expect(two.length).toBeLessThan(one.length)
  })

  it("ignores case and surrounding space", () => {
    expect(searchPrompts(libraryPrompts, "  ROOT Cause ")).toHaveLength(
      searchPrompts(libraryPrompts, "root cause").length
    )
  })

  it("returns everything for an empty query", () => {
    expect(searchPrompts(libraryPrompts, "   ")).toHaveLength(
      libraryPrompts.length
    )
  })

  it("returns nothing rather than everything for a miss", () => {
    expect(searchPrompts(libraryPrompts, "zzzzqqq")).toHaveLength(0)
  })
})
