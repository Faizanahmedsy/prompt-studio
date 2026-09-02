import { describe, expect, it } from "vitest"

import {
  inDeadZone,
  inGamut,
  LC_FLOORS,
  lc,
  parseOklch,
} from "@/features/theme/color"
import {
  DEFAULT_PRESET,
  type Preset,
  presetById,
  presets,
  tokenKeys,
} from "@/features/theme/data/presets"
import { elevationStrategyValues, motionModelValues } from "@/types/project"

/**
 * The shadcn variable set, spelled out rather than imported, so that a preset
 * and the contract cannot drift together. There is no `destructive-foreground`
 * in current shadcn; if one appears here it has to appear in shadcn first.
 */
const SHADCN_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
]

const modes = ["light", "dark"] as const

/** Surface, the text that sits on it, and the level that text has to reach. */
const PAIRS: Array<[string, string, number]> = [
  ["background", "foreground", LC_FLOORS.body],
  ["card", "card-foreground", LC_FLOORS.body],
  ["popover", "popover-foreground", LC_FLOORS.body],
  ["muted", "muted-foreground", LC_FLOORS.secondary],
  ["primary", "primary-foreground", LC_FLOORS.body],
  ["sidebar", "sidebar-foreground", LC_FLOORS.body],
  ["secondary", "secondary-foreground", LC_FLOORS.body],
  ["accent", "accent-foreground", LC_FLOORS.body],
  ["sidebar-primary", "sidebar-primary-foreground", LC_FLOORS.body],
  ["sidebar-accent", "sidebar-accent-foreground", LC_FLOORS.body],
]

/** Filled controls: a label has to sit on these, so their lightness is constrained. */
const FILLS = ["primary", "destructive"]

describe("the token contract", () => {
  it("is the shadcn variable set, exactly", () => {
    expect([...tokenKeys].sort()).toEqual([...SHADCN_TOKENS].sort())
  })

  it("does not carry a destructive-foreground that shadcn would ignore", () => {
    expect(tokenKeys).not.toContain("destructive-foreground")
  })
})

describe("the catalogue", () => {
  it("offers fourteen presets with unique ids", () => {
    expect(presets).toHaveLength(14)
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(14)
  })

  it("resolves the default", () => {
    expect(presetById(DEFAULT_PRESET).id).toBe(DEFAULT_PRESET)
    expect(presets.some((preset) => preset.id === DEFAULT_PRESET)).toBe(true)
  })

  it("falls back to the default for an id that no longer exists", () => {
    expect(presetById("atrium-2019").id).toBe(DEFAULT_PRESET)
    expect(presetById("").id).toBe(DEFAULT_PRESET)
  })

  /**
   * The anti-hue-rotation check, and the reason this file exists.
   *
   * A catalogue where two entries share their shape, density, elevation and
   * motion is a catalogue with a spare palette in it, whatever its hues say.
   */
  it("gives every preset its own shape, density, elevation and motion", () => {
    const commitments = presets.map((preset) =>
      JSON.stringify([
        preset.shape,
        preset.density,
        preset.elevationStrategy,
        preset.motionModel,
      ])
    )
    expect(new Set(commitments).size).toBe(presets.length)
  })

  it("uses every elevation strategy and every motion model at least once", () => {
    const used = new Set(presets.map((preset) => preset.elevationStrategy))
    expect([...elevationStrategyValues].every((value) => used.has(value))).toBe(
      true
    )
    const motions = new Set(presets.map((preset) => preset.motionModel))
    expect([...motionModelValues].every((value) => motions.has(value))).toBe(
      true
    )
  })

  it("gives every preset its own display face", () => {
    const display = presets.map((preset) => preset.fonts.display)
    expect(new Set(display).size).toBe(presets.length)
  })
})

describe.each(presets.map((preset) => [preset.id, preset] as [string, Preset]))(
  "%s",
  (_id, preset) => {
    it("describes itself in nouns and numbers", () => {
      expect(preset.name.length).toBeGreaterThan(0)
      expect(preset.character.length).toBeGreaterThan(30)
      expect(preset.axes.length).toBeGreaterThanOrEqual(3)
      // A build agent cannot act on an adjective, so this has to carry values.
      expect(preset.promptDetails.length).toBeGreaterThan(300)
      expect(preset.promptDetails).toMatch(/\d/)
      expect(preset.fonts.display.length).toBeGreaterThan(0)
      expect(preset.fonts.body.length).toBeGreaterThan(0)
      expect(preset.fonts.mono.length).toBeGreaterThan(0)
    })

    it("stays inside the schema's ranges", () => {
      expect(preset.scaleRatio).toBeGreaterThanOrEqual(1.05)
      expect(preset.scaleRatio).toBeLessThanOrEqual(1.7)
      expect(preset.vividness).toBeGreaterThanOrEqual(0)
      expect(preset.vividness).toBeLessThanOrEqual(100)
      expect(preset.neutralHue).toBeGreaterThanOrEqual(0)
      expect(preset.neutralHue).toBeLessThanOrEqual(360)
    })

    describe.each(modes)("%s", (mode) => {
      const tokens = preset[mode]

      it("carries the full token set and nothing besides", () => {
        expect(Object.keys(tokens).sort()).toEqual([...SHADCN_TOKENS].sort())
      })

      it("is made of colours that exist in sRGB", () => {
        for (const [key, value] of Object.entries(tokens)) {
          const parsed = parseOklch(value)
          expect(parsed, `${key} is not a colour: ${value}`).not.toBeNull()
          expect(inGamut(parsed!), `${key} is outside sRGB: ${value}`).toBe(
            true
          )
        }
      })

      it("puts readable text on every surface", () => {
        for (const [surface, text, floor] of PAIRS) {
          const measured = Math.abs(lc(tokens[text], tokens[surface]))
          expect(
            measured,
            `${text} on ${surface} is Lc ${measured.toFixed(1)}, floor ${floor}`
          ).toBeGreaterThanOrEqual(floor)
        }
      })

      it("keeps filled controls out of the dead zone", () => {
        for (const key of FILLS) {
          const parsed = parseOklch(tokens[key])!
          expect(inDeadZone(parsed.l), `${key} sits at L ${parsed.l}`).toBe(
            false
          )
        }
      })

      it("borders the dark mode with alpha rather than a flat grey", () => {
        if (mode !== "dark") return
        expect(tokens.border).toBe("oklch(1 0 0 / 10%)")
        expect(tokens.input).toBe("oklch(1 0 0 / 15%)")
      })
    })

    it("re-decides dark mode instead of inverting light", () => {
      const lightFg = parseOklch(preset.light.foreground)!
      const darkFg = parseOklch(preset.dark.foreground)!
      // An inversion would put dark text at 1 - 0.24 = 0.76, which is nowhere
      // near where dark mode's tonal room actually is.
      expect(darkFg.l).toBeGreaterThan(0.9)
      expect(lightFg.l).toBeLessThan(0.35)
    })
  }
)
