import { describe, expect, it } from "vitest"

import { parseFlow } from "@/features/flow-lang/parser"
import { resolveTokens } from "@/features/theme/tokens"
import { themeSchema } from "@/types/project"

/**
 * The pre-preset fields still have to mean something.
 *
 * Every starter and every `.flow` file anyone has saved sets `radius`,
 * `buttons`, `type scale`, `elevation`, `motion` or a font character. They
 * stopped being read when presets landed, so an old file opened looking nothing
 * like what it said — the parser accepted `radius large` and the editor drew
 * the preset's radii. They are a fallback layer now, and this is the test that
 * says so.
 */
function themeOf(flow: string) {
  const parsed = parseFlow(flow)
  expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0)
  return parsed.doc.theme
}

const FLOW = (theme: string) => `app "Legacy"\n\ntheme { ${theme} }\n\nscreen Home { layout dashboard }\n`

describe("an old flow file still gets the design it asked for", () => {
  it("maps radius onto the shape tokens", () => {
    const large = resolveTokens(themeOf(FLOW("radius large")))
    const none = resolveTokens(themeOf(FLOW("radius none")))
    expect(large.shape.card).toBeGreaterThan(none.shape.card)
    expect(none.shape.control).toBe(0)
  })

  it("turns a full radius and rounded buttons into pills", () => {
    expect(resolveTokens(themeOf(FLOW("radius full"))).shape.pill).toBe(true)
    expect(resolveTokens(themeOf(FLOW("buttons rounded"))).shape.pill).toBe(true)
  })

  it("maps the type scale onto a ratio", () => {
    const compact = resolveTokens(themeOf(FLOW("scale compact")))
    const expressive = resolveTokens(themeOf(FLOW("scale expressive")))
    expect(expressive.scaleRatio).toBeGreaterThan(compact.scaleRatio)
  })

  it("maps elevation and motion onto the strategies that replaced them", () => {
    const flat = resolveTokens(themeOf(FLOW("elevation flat")))
    // hairline: depth is a border, so there is no shadow value at all.
    expect(flat.elevation.shadow).toBe("")
    const still = resolveTokens(themeOf(FLOW("motion none")))
    expect(still.motion.model).toBe("none")
  })

  it("gives a font character a real family", () => {
    const slab = resolveTokens(themeOf(FLOW("headings slab")))
    expect(slab.fonts.display).toBe("Roboto Slab")
  })

  it("lets the preset win when the old file said nothing", () => {
    // The whole point of the fallback: it applies to fields somebody moved, and
    // stays out of the way otherwise.
    const withPreset = resolveTokens(themeOf(FLOW("preset telegraph")))
    expect(withPreset.fonts.display).toBe("Roboto Slab")
    expect(withPreset.shape.card).toBe(2)
  })

  it("lets an explicit legacy value beat the preset it was written before", () => {
    const both = resolveTokens(themeOf(FLOW("preset telegraph; radius full")))
    expect(both.shape.pill).toBe(true)
    expect(both.shape.card).toBe(20)
  })

  it("leaves a default alone", () => {
    const bare = resolveTokens(themeSchema.parse({}))
    const preset = resolveTokens(themeSchema.parse({ preset: "atrium" }))
    expect(bare.shape).toEqual(preset.shape)
  })
})
