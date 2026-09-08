import { describe, expect, it } from "vitest"

import {
  libraryPrompts,
  promptById,
  promptCategories,
  searchPrompts,
} from "@/features/prompt-library/data/prompts"
import { modeFromSlug, STUDIO_HOME, VIEW_SLUGS } from "@/lib/view-url"

/**
 * The library ships prompts, not components — so the tests that matter are
 * about the text. A prompt with a placeholder nobody filled in, or a body
 * short enough to be a summary of a prompt rather than a prompt, is the
 * failure this file exists to catch.
 */
describe("the library holds usable prompts", () => {
  it("lives on a public route, not on a studio tab", () => {
    // The library needs no account and no project, so /prompts is a page of
    // its own rather than a mode of the workbench. If it were a studio slug
    // the catch-all would claim the path and put it back behind the login.
    expect(modeFromSlug("prompts")).toBeNull()
    expect(Object.values(VIEW_SLUGS)).not.toContain("prompts")
    expect(STUDIO_HOME).toBe("/web")
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

describe("the master design prompt", () => {
  const master = promptById.get("master-design")
  const body = master?.body ?? ""

  it("is the first thing in the library", () => {
    expect(libraryPrompts[0].id).toBe("master-design")
  })

  it("replaced the three single-look prompts rather than joining them", () => {
    // Three prompts each asserting one aesthetic as universal is how a school
    // came back built as a console. There is one design brief now.
    for (const gone of ["instrument-ui", "dark-console", "light-saas"]) {
      expect(promptById.has(gone), `${gone} should be gone`).toBe(false)
    }
    expect(libraryPrompts.filter((p) => p.category === "Design")).toHaveLength(3)
  })

  it("makes the model classify and name a direction before any code", () => {
    const classify = body.indexOf("PART 0")
    const laws = body.indexOf("PART 1")
    const directions = body.indexOf("PART 2")
    expect(classify).toBeGreaterThan(-1)
    expect(classify).toBeLessThan(laws)
    expect(laws).toBeLessThan(directions)
    expect(body).toMatch(/Direction: \[name\]\. Chosen because:/)
    expect(body).toMatch(/Do not blend two directions/)
  })

  it.each([
    "EDITORIAL INSTITUTIONAL",
    "LIGHT PRODUCT",
    "TECHNICAL CONSOLE",
    "OPERATIONAL DENSE",
    "WARM CONSUMER",
    "QUIET LUXURY",
    "UTILITY BRUTAL",
    "EXPRESSIVE APP",
  ])("offers the %s direction", (name) => {
    expect(body).toContain(`DIRECTION`)
    expect(body).toContain(name)
  })

  it("tells you when each direction is wrong, not only when it is right", () => {
    // A catalogue of eight looks with no exclusions is eight ways to guess.
    const chooseWhen = body.match(/\*\*Choose when\*\*/g)?.length ?? 0
    const neverChoose = body.match(/\*\*Never choose when\*\*/g)?.length ?? 0
    const failModes = body.match(/\*\*Fail mode/g)?.length ?? 0
    expect(chooseWhen).toBe(8)
    expect(neverChoose).toBe(8)
    expect(failModes).toBe(8)
  })

  it("routes an institution away from the console look", () => {
    // The bug this rewrite exists for: a school built as telemetry.
    expect(body).toMatch(/schools, universities, museums/)
    expect(body).toMatch(/An institution does not report its own vital signs/)
    expect(body).toMatch(/impersonating one/)
  })
})

describe("the monospace rule that let a school render as a dashboard", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it("turns monospace off by default rather than recommending it", () => {
    expect(body).toContain("MONOSPACE IS OFF BY DEFAULT")
    // The old wording survives only as the mistake being corrected, which is
    // what stops a reader reintroducing it.
    expect(body).toContain("A previous version of this brief called monospace")
  })

  it("caps how many roles may use it", () => {
    expect(body).toMatch(/pick \*\*at most two\*\* of these roles/)
    expect(body).toMatch(/five percent of the visible words/)
  })

  it("names the places it is never allowed", () => {
    for (const banned of [
      "body text",
      "navigation",
      "buttons",
      "form labels",
      "card titles",
      "stat labels",
      "mottos",
      "people's names",
    ]) {
      expect(body, `${banned} should be on the never list`).toContain(banned)
    }
  })

  it("gives the correct fix for aligning numbers instead", () => {
    expect(body).toMatch(/tabular-nums/)
  })

  it("counts it in the audit rather than only asking about it", () => {
    expect(body).toMatch(/Monospace count/)
  })

  it("says so in the critique prompt too", () => {
    const critique = promptById.get("design-critique")?.body ?? ""
    expect(critique).toMatch(/Monospace\./)
    expect(critique).toMatch(/Register\./)
  })
})

describe("the illustration language", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it("insists the art is built, not bought", () => {
    expect(body).toMatch(/No image files, no icon library scaled up/)
    expect(body).toMatch(/inline SVG in the codebase/)
  })

  it("makes the art re-skin with the palette instead of hard-coding it", () => {
    expect(body).toMatch(/color-mix\(in oklch/)
    expect(body).toMatch(/Colour comes from tokens, never from literals/)
  })

  it("names the four moves that make the soft-3D look", () => {
    for (const move of [
      /A contact shadow/,
      /Light from the top-left/,
      /A gloss/,
      /Generous radii/,
    ]) {
      expect(body).toMatch(move)
    }
  })

  it("carries the id-collision trap, which looks like a rendering bug", () => {
    expect(body).toMatch(/Ids must be namespaced/)
    expect(body).toMatch(/silently steal each other's gradients/)
  })

  it("labels by meaning rather than by drawing", () => {
    expect(body).toMatch(/aria-label="Waiting for approval"/)
    expect(body).toMatch(/never `aria-label="Clipboard with clock"`/)
  })

  it("is not universal — it says which directions take it and which take none", () => {
    // The same mistake as the console look: one treatment asserted everywhere.
    expect(body).toMatch(/Illustration is not universal/)
    expect(body).toMatch(/Quiet Luxury\*\* — none/)
    expect(body).toMatch(/Utility Brutal\*\* — none at all/)
    expect(body).toMatch(/Clay objects make an institution look like a startup/)
  })

  it("is checked in the audit", () => {
    expect(body).toMatch(/\*\*Illustration\.\*\* Any stock art/)
  })
})

describe("the laws that survived from the five-way test", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it.each([
    ["one accent", /One accent colour carries every piece of emphasis/],
    ["an accent ceiling", /under five percent of the pixels/],
    ["no placeholder content", /Never ship placeholder content/],
    ["an uneven grid", /let the grid be uneven/],
    ["varied rhythm", /Vary vertical rhythm between sections/],
    ["one motion idea", /Pick one signature move/],
    ["radius stepping down", /step it \*down\* as you nest/],
    ["an accessibility floor", /the floor — non-negotiable/i],
    ["a designed narrow layout", /not as the wide one stacked/],
  ])("keeps the %s law", (_name, pattern) => {
    expect(body).toMatch(pattern)
  })

  it("carries components and a never-list, not principles alone", () => {
    expect(body).toContain("PART 3 — COMPONENTS")
    expect(body).toContain("PART 4 — ILLUSTRATION")
    expect(body).toContain("PART 5 — NEVER SHIP THESE")
    expect(body).toContain("PART 6 — AUDIT BEFORE YOU ANSWER")
    // The never-list is numbered, so it can be checked one line at a time.
    expect(body).toMatch(/^25\. /m)
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
