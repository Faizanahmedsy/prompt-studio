import { describe, expect, it } from "vitest"

import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { buildFragmentPrompt } from "@/features/flow-lang/fragment-prompt"
import { allLayouts } from "@/features/library/data/layouts"
import { starterDoc } from "@/features/library/data/starters"
import { screenTemplates } from "@/features/library/data/templates"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import type { ProjectDoc } from "@/types/project"

/**
 * A consumer product's home screen is the map, the feed or the collection —
 * not a summary of them. Three separate things have to hold for that to come
 * out of the generator, and each failed independently before this file:
 *
 *  1. the catalogue has to *contain* a consumer home screen, or a model told
 *     to pick the closest listed id can only reach for `dashboard-cards`;
 *  2. the authoring prompt has to say which screen is the entry point and
 *     what belongs on it;
 *  3. the build prompt has to repeat it, because a hand-drawn flow never
 *     passes through the authoring prompt at all.
 */

const doc = starterDoc("saas-dashboard")!

describe("the catalogue offers a consumer home screen", () => {
  const screens = allLayouts.filter((l) => l.scope === "screen")
  const web = screens.filter((l) => !l.category.startsWith("Mobile"))

  it("has an Explore category on the web, not only on mobile", () => {
    expect(web.some((l) => l.category === "Explore")).toBe(true)
  })

  it.each(["map-explore", "split-map-list", "feed-stream", "browse-grid", "search-first", "canvas-editor"])(
    "offers %s",
    (id) => {
      const layout = screens.find((l) => l.id === id)
      expect(layout, `${id} is missing from the layout catalogue`).toBeDefined()
      expect(layout?.category).toBe("Explore")
      expect(layout?.promptDetails.length).toBeGreaterThan(80)
    }
  )

  it("gives the explore template a layout that exists", () => {
    const template = screenTemplates.find((t) => t.id === "explore")
    expect(template).toBeDefined()
    expect(screens.some((l) => l.id === template?.defaultLayout)).toBe(true)
  })

  // `landing` deliberately defaults to a section layout, so this checks the
  // catalogue as a whole rather than the screen half of it.
  it("keeps every template's default layout resolvable", () => {
    for (const template of screenTemplates) {
      expect(
        allLayouts.some((l) => l.id === template.defaultLayout),
        `${template.id} defaults to ${template.defaultLayout}, which is not in the catalogue`
      ).toBe(true)
    }
  })

  it("gives every Explore layout a wire to draw", () => {
    for (const layout of screens.filter((l) => l.category === "Explore")) {
      expect(layout.wire, `${layout.id} has no wire`).toBeTruthy()
    }
  })
})

describe("the authoring prompt decides the entry screen", () => {
  const prompt = buildAuthoringPrompt(doc)

  it("asks who opens the product before it asks for screens", () => {
    const audience = prompt.indexOf("Who opens this?")
    const rules = prompt.indexOf("# Output rules")
    expect(audience).toBeGreaterThan(-1)
    expect(audience).toBeLessThan(rules)
  })

  it("names the primary action as the thing the entry screen renders", () => {
    expect(prompt).toContain("What single thing did they come to do?")
    expect(prompt).toMatch(/entry screen renders that one\s+thing, at full size/)
  })

  it("says who metric tiles are for", () => {
    expect(prompt).toMatch(/Metric cards, KPI tiles, activity feeds[\s\S]{0,60}belong to operators/)
  })

  it("carries the worked example both ways round", () => {
    expect(prompt).toContain("**Wrong:**")
    expect(prompt).toContain("**Right:**")
    expect(prompt).toContain("dashboard-cards")
    expect(prompt).toContain("map-explore")
  })

  it("makes the model re-read its entry screen before it answers", () => {
    const check = prompt.indexOf("# Check before you output")
    expect(check).toBeGreaterThan(prompt.indexOf("# Output rules"))
    expect(check).toBeLessThan(prompt.indexOf("# Grammar"))
    expect(prompt).toContain("rewrite the entry screen before you output")
  })

  it("advertises the explore template and its layouts as valid ids", () => {
    expect(prompt).toContain("`explore`")
    expect(prompt).toContain("`map-explore`")
    expect(prompt).toContain("`feed-stream`")
  })
})

describe("the fragment prompt does not call the anchor a dashboard", () => {
  it("falls back to home when the project has no screens yet", () => {
    const empty: ProjectDoc = { ...doc, screens: [], modules: [], edges: [] }
    const prompt = buildFragmentPrompt(empty)
    expect(prompt).toContain("screen home {")
    expect(prompt).not.toContain("screen dashboard {")
  })
})

describe("the build prompt repeats the rule for hand-drawn flows", () => {
  it("tells the agent what belongs on the entry screen", () => {
    const { text } = buildPrompt(doc)
    expect(text).toContain("Entry point")
    expect(text).toMatch(/first and largest thing on the page/)
    expect(text).toMatch(/grid of tiles linking to the other screens/)
  })

  it("says nothing about entry points when there are no screens", () => {
    const empty: ProjectDoc = { ...doc, screens: [], modules: [], edges: [] }
    expect(buildPrompt(empty).text).not.toMatch(/first and largest thing on the page/)
  })
})
