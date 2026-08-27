import { describe, expect, it } from "vitest"

import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { starterDoc } from "@/features/library/data/starters"
import { buildProjectPrompt } from "@/features/prompt/engine/build-project-prompt"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { promptTargets } from "@/features/prompt/engine/targets"
import {
  DEFAULT_UI_LEVEL,
  describeUiLevel,
  uiLevelFromLegacyCreativity,
  uiLevelOf,
  uiLevels,
} from "@/features/theme/data/ui-levels"
import { type ProjectDoc, projectDocSchema } from "@/types/project"

const base = () => starterDoc("saas-dashboard")!
const at = (level: number): ProjectDoc => ({ ...base(), target: "generic", uiLevel: level })

describe("the five levels", () => {
  it("offers exactly five, numbered 1 to 5", () => {
    expect(uiLevels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5])
  })

  it("gives every level a name and real build instructions", () => {
    for (const level of uiLevels) {
      expect(level.name.length).toBeGreaterThan(0)
      expect(level.hint.length).toBeGreaterThan(0)
      // Not a number dressed up as a sentence — it has to say what to build.
      expect(level.promptDetails.length).toBeGreaterThan(120)
    }
  })

  it("falls back to the default for a level that does not exist", () => {
    expect(describeUiLevel(0).level).toBe(DEFAULT_UI_LEVEL)
    expect(describeUiLevel(9).level).toBe(DEFAULT_UI_LEVEL)
    expect(describeUiLevel(Number.NaN).level).toBe(DEFAULT_UI_LEVEL)
  })

  it("escalates: only the top levels invite animation", () => {
    const one = describeUiLevel(1).promptDetails.toLowerCase()
    const five = describeUiLevel(5).promptDetails.toLowerCase()
    expect(one).toContain("no sections, decoration, illustration or animation")
    expect(five).toMatch(/risk|showpiece|point of view/)
  })

  it("keeps the ambitious levels accessible", () => {
    // A dial that turns off reduced-motion support is a dial that ships a bug.
    for (const level of [4, 5]) {
      // "prefers-reduced-motion" or "reduced motion" — either wording counts.
      expect(describeUiLevel(level).promptDetails).toMatch(/reduced[- ]motion/i)
    }
  })
})

describe("what reaches the prompt", () => {
  it("names the level rather than printing a bare number", () => {
    const text = buildPrompt(at(4)).text
    expect(text).toContain("Creative level 4 of 5 — Expressive")
    expect(text).not.toContain("Creative latitude")
  })

  it("carries that level's instructions and no other level's", () => {
    const text = buildPrompt(at(1)).text
    expect(text).toContain(describeUiLevel(1).promptDetails)
    expect(text).not.toContain(describeUiLevel(5).promptDetails)
  })

  it("asks the agent to judge from the journeys before applying the level", () => {
    // The point of the feature: not "add this much decoration", but "work out
    // what these people actually need, then stay under this ceiling".
    const text = buildPrompt(at(5)).text
    expect(text).toContain("Decide how much interface this product actually needs")
    expect(text).toContain("who is on it, what are they trying to finish")
  })

  it("reaches every target", () => {
    for (const target of promptTargets) {
      const text = buildPrompt({ ...at(2), target: target.id }).text
      expect(text, target.id).toContain("Creative level 2 of 5")
    }
  })

  it("reaches the multi-build prompt too", () => {
    const doc = { ...starterDoc("full-system")!, target: "generic", uiLevel: 5 }
    expect(buildProjectPrompt(doc).text).toContain("Creative level 5 of 5")
  })

  it("stands down for the Basic design language, which says not to design", () => {
    const doc = { ...at(5), theme: { ...base().theme, designLanguage: "basic" } }
    const text = buildPrompt(doc).text
    expect(text).toContain("The creative level does not apply here")
    expect(text).not.toContain(describeUiLevel(5).promptDetails)
  })
})

describe("upgrading a project that predates the scale", () => {
  it("maps the old 0-10 dial onto the five levels", () => {
    expect([0, 1, 2].map(uiLevelFromLegacyCreativity)).toEqual([1, 1, 1])
    expect([3, 4].map(uiLevelFromLegacyCreativity)).toEqual([2, 2])
    expect([5, 6].map(uiLevelFromLegacyCreativity)).toEqual([3, 3])
    expect([7, 8].map(uiLevelFromLegacyCreativity)).toEqual([4, 4])
    expect([9, 10].map(uiLevelFromLegacyCreativity)).toEqual([5, 5])
  })

  it("keeps the setting its owner actually chose, rather than resetting it", () => {
    // A project saved at "Bold" must not silently come back as the default.
    const older = { ...base(), creativity: 9, uiLevel: null }
    expect(uiLevelOf(older)).toBe(5)
    expect(buildPrompt({ ...older, target: "generic" }).text).toContain("Creative level 5 of 5")
  })

  it("prefers an explicit level over the legacy value", () => {
    expect(uiLevelOf({ creativity: 9, uiLevel: 1 })).toBe(1)
  })

  it("defaults when a document carries neither", () => {
    expect(uiLevelOf({})).toBe(DEFAULT_UI_LEVEL)
  })

  it("still parses a document written before the field existed", () => {
    const { uiLevel: _dropped, ...older } = base()
    const parsed = projectDocSchema.parse({ ...older, creativity: 7 })
    expect(parsed.uiLevel).toBeNull()
    expect(uiLevelOf(parsed)).toBe(4)
  })

  it("refuses a level outside 1-5 rather than storing it", () => {
    expect(projectDocSchema.safeParse({ ...base(), uiLevel: 7 }).success).toBe(false)
    expect(projectDocSchema.safeParse({ ...base(), uiLevel: 0 }).success).toBe(false)
  })
})

describe("the Flow round trip", () => {
  it("writes ui_level, not the retired keyword", () => {
    const source = serializeFlow(at(4))
    expect(source).toContain("ui_level 4")
    expect(source).not.toContain("creativity")
  })

  it("reads ui_level back", () => {
    expect(parseFlow(serializeFlow(at(2))).doc.uiLevel).toBe(2)
  })

  it("still reads a file written with the old creativity keyword", () => {
    const { doc, warnings } = parseFlow(`app "Legacy" {\n  creativity 9\n}\nflow { a -> b }`)
    expect(doc.uiLevel).toBe(5)
    expect(warnings.filter((w) => w.message.includes("Creativity"))).toHaveLength(0)
  })

  it("lets an explicit ui_level win over a legacy line in the same file", () => {
    const { doc } = parseFlow(
      `app "Both" {\n  ui_level 1\n  creativity 9\n}\nflow { a -> b }`
    )
    expect(doc.uiLevel).toBe(1)
  })

  it("warns instead of guessing on a level that is not a number", () => {
    const { warnings } = parseFlow(`app "Bad" {\n  ui_level loud\n}\nflow { a -> b }`)
    expect(warnings.some((w) => w.message.includes("ui_level"))).toBe(true)
  })

  it("clamps a level outside the range rather than rejecting the file", () => {
    expect(parseFlow(`app "H" {\n  ui_level 99\n}\nflow { a -> b }`).doc.uiLevel).toBe(5)
    expect(parseFlow(`app "L" {\n  ui_level -4\n}\nflow { a -> b }`).doc.uiLevel).toBe(1)
  })
})
