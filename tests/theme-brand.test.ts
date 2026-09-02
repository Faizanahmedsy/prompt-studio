import { describe, expect, it } from "vitest"

import { LC_FLOORS, lc } from "@/features/theme/color/apca"
import { hexToOklch, parseOklch } from "@/features/theme/color/oklch"
import { presetById } from "@/features/theme/data/presets"
import { resolveTokens } from "@/features/theme/tokens"
import { themeSchema } from "@/types/project"

/**
 * The two colour fields shipped for months writing a value nothing read.
 *
 * That is the failure this file exists to catch: not a wrong colour, but a
 * control that moves a number no stylesheet consults. Every assertion here is
 * about the value actually reaching the resolved token set.
 */
const base = () => themeSchema.parse({ preset: "atrium" })

describe("the brand colours reach the tokens", () => {
  it("leaves the preset alone while they sit on the default", () => {
    const preset = presetById("atrium")
    const tokens = resolveTokens(base())
    expect(tokens.light.primary).toBe(preset.light.primary)
    expect(tokens.dark.primary).toBe(preset.dark.primary)
  })

  it("puts the chosen primary on the primary token", () => {
    const tokens = resolveTokens({ ...base(), primaryColor: "#FF00D0" })
    const chosen = hexToOklch("#FF00D0")!
    const resolved = parseOklch(tokens.light.primary)!
    expect(Math.abs(resolved.h - chosen.h)).toBeLessThan(2)
    expect(resolved.c).toBeGreaterThan(0.1)
    expect(tokens.light.primary).not.toBe(presetById("atrium").light.primary)
  })

  it("carries it to everything that is the same decision", () => {
    const tokens = resolveTokens({ ...base(), primaryColor: "#1D4ED8" })
    expect(tokens.light["sidebar-primary"]).toBe(tokens.light.primary)
    const ring = parseOklch(tokens.light.ring)!
    const brand = hexToOklch("#1D4ED8")!
    expect(Math.abs(ring.h - brand.h)).toBeLessThan(2)
    const chart = parseOklch(tokens.light["chart-1"])!
    expect(Math.abs(chart.h - brand.h)).toBeLessThan(2)
  })

  it("keeps the label readable on whatever was picked", () => {
    // Including the two that break naive implementations: a colour in the dead
    // zone, and one so light that white text vanishes on it.
    for (const hex of ["#FF00D0", "#FFE600", "#B6C948", "#0A0A23", "#1D4ED8"]) {
      const tokens = resolveTokens({ ...base(), primaryColor: hex })
      for (const mode of ["light", "dark"] as const) {
        const measured = Math.abs(
          lc(tokens[mode]["primary-foreground"], tokens[mode].primary)
        )
        expect(
          measured,
          `${hex} in ${mode} is Lc ${measured.toFixed(1)}`
        ).toBeGreaterThanOrEqual(LC_FLOORS.body)
      }
    }
  })

  it("re-decides dark rather than reusing the hex", () => {
    const tokens = resolveTokens({ ...base(), primaryColor: "#1D4ED8" })
    const dark = parseOklch(tokens.dark.primary)!
    // A dark-mode primary at the hex's own lightness is a dark fill on a dark
    // ground, which is the bug this asserts against.
    expect(dark.l).toBeGreaterThan(0.7)
  })

  it("sends the secondary to the chart ramp and the accent tint", () => {
    const tokens = resolveTokens({ ...base(), secondaryColor: "#0EA5E9" })
    const brand = hexToOklch("#0EA5E9")!
    const chart = parseOklch(tokens.light["chart-2"])!
    expect(Math.abs(chart.h - brand.h)).toBeLessThan(2)
    const accent = parseOklch(tokens.light.accent)!
    expect(Math.abs(accent.h - brand.h)).toBeLessThan(2)
    // A hover fill, not a brand moment.
    expect(accent.c).toBeLessThanOrEqual(0.05)
    const measured = Math.abs(
      lc(tokens.light["accent-foreground"], tokens.light.accent)
    )
    expect(measured).toBeGreaterThanOrEqual(LC_FLOORS.body)
  })

  it("still lets a hand-picked token win", () => {
    const tokens = resolveTokens({
      ...base(),
      primaryColor: "#FF00D0",
      palette: { light: { primary: "oklch(0.5 0.2 140)" }, dark: {} },
    })
    expect(tokens.light.primary).toBe("oklch(0.5 0.2 140)")
  })
})
