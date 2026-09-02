import { describe, expect, it } from "vitest"

import {
  clampToGamut,
  formatOklch,
  hexToOklch,
  hexToRgb,
  inDeadZone,
  inGamut,
  LC_FLOORS,
  lc,
  maxChroma,
  oklchToHex,
  parseOklch,
  withVividness,
} from "@/features/theme/color"

/** Same colour to the nearest byte — the round trip is allowed one step of rounding, not two. */
const sameColor = (a: string, b: string) => {
  const left = hexToRgb(a)!
  const right = hexToRgb(b)!
  for (const key of ["r", "g", "b"] as const) {
    expect(Math.abs(left[key] - right[key])).toBeLessThanOrEqual(1.001 / 255)
  }
}

describe("hex and OKLCH", () => {
  const samples = [
    "#000000",
    "#ffffff",
    "#4f46e5",
    "#0ea5e9",
    "#f97316",
    "#dc2626",
    "#16a34a",
    "#1a1a1a",
    "#7f8c8d",
    "#fde047",
  ]

  it("survives the round trip", () => {
    for (const hex of samples) sameColor(oklchToHex(hexToOklch(hex)!), hex)
  })

  it("expands shorthand and ignores the alpha byte", () => {
    sameColor(oklchToHex(hexToOklch("#f0a")!), "#ff00aa")
    sameColor(oklchToHex(hexToOklch("#4f46e580")!), "#4f46e5")
  })

  it("returns null rather than guessing at nonsense", () => {
    expect(hexToOklch("#12345")).toBeNull()
    expect(hexToOklch("rebeccapurple")).toBeNull()
    expect(parseOklch("oklch(nope)")).toBeNull()
  })

  it("reads the alpha form the dark palettes use for borders", () => {
    const parsed = parseOklch("oklch(1 0 0 / 10%)")!
    expect(parsed.l).toBe(1)
    expect(parsed.alpha).toBeCloseTo(0.1, 5)
  })
})

describe("formatOklch", () => {
  it("writes the string shadcn writes", () => {
    expect(formatOklch({ l: 0.646, c: 0.222, h: 41.116 })).toBe(
      "oklch(0.646 0.222 41.116)"
    )
  })

  it("trims trailing zeros instead of padding to three places", () => {
    expect(formatOklch({ l: 1, c: 0, h: 0 })).toBe("oklch(1 0 0)")
    expect(formatOklch({ l: 0.97, c: 0, h: 0 })).toBe("oklch(0.97 0 0)")
    expect(formatOklch({ l: 0.2, c: 0.1, h: 30 })).toBe("oklch(0.2 0.1 30)")
  })

  it("rounds to three decimals", () => {
    expect(formatOklch({ l: 0.5772345, c: 0.2451234, h: 27.3254 })).toBe(
      "oklch(0.577 0.245 27.325)"
    )
  })

  it("drops the hue of an achromatic colour, because a grey has no hue to keep", () => {
    expect(formatOklch({ l: 0.5, c: 0, h: 217 })).toBe("oklch(0.5 0 0)")
  })

  it("wraps the hue rather than emitting a value CSS would reject", () => {
    expect(formatOklch({ l: 0.5, c: 0.1, h: 380 })).toBe("oklch(0.5 0.1 20)")
    expect(formatOklch({ l: 0.5, c: 0.1, h: -20 })).toBe("oklch(0.5 0.1 340)")
  })
})

describe("the sRGB gamut", () => {
  const lightnesses = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]
  const hues = [0, 45, 90, 135, 180, 225, 270, 315]

  it("finds a chroma that fits and stops before one that does not", () => {
    for (const l of lightnesses) {
      for (const h of hues) {
        const c = maxChroma(l, h)
        expect(inGamut({ l, c, h })).toBe(true)
        expect(inGamut({ l, c: c + 0.01, h })).toBe(false)
      }
    }
  })

  it("has next to no room at either end of the lightness axis", () => {
    expect(maxChroma(1, 70)).toBeLessThan(0.001)
    // Not exactly zero at the black end: the gamut tolerance is worth more than
    // the chroma down there, and every colour it admits renders as black.
    expect(maxChroma(0, 70)).toBeLessThan(0.02)
    expect(maxChroma(0, 70)).toBeLessThan(maxChroma(0.6, 70))
  })

  it("reads vividness as a percentage of that ceiling", () => {
    const ceiling = maxChroma(0.6, 264)
    expect(withVividness(0.6, 264, 0)).toBe(0)
    expect(withVividness(0.6, 264, 100)).toBeCloseTo(ceiling, 6)
    expect(withVividness(0.6, 264, 50)).toBeCloseTo(ceiling / 2, 6)
  })

  it("keeps a full hue rotation inside sRGB, which is the whole point of it", () => {
    // A fixed chroma of 0.15 is a rich blue, a muddy red and an impossible
    // yellow. A fixed vividness is the same saturation everywhere.
    for (let h = 0; h < 360; h += 10) {
      expect(inGamut({ l: 0.62, c: withVividness(0.62, h, 100), h })).toBe(true)
    }
  })

  it("gives up chroma and nothing else when clamping", () => {
    const clamped = clampToGamut({ l: 0.62, c: 0.4, h: 140 })
    expect(clamped.l).toBe(0.62)
    expect(clamped.h).toBe(140)
    expect(clamped.c).toBeLessThan(0.4)
    expect(inGamut(clamped)).toBe(true)
  })

  it("leaves a colour that already fits alone", () => {
    expect(clampToGamut({ l: 0.5, c: 0.05, h: 200 })).toEqual({
      l: 0.5,
      c: 0.05,
      h: 200,
    })
  })
})

describe("APCA", () => {
  // Published APCA-W3 0.1.9 reference values. The sign is the polarity, not
  // noise: positive is dark text on a light background, negative is light text
  // on a dark one, and the two are deliberately not the same magnitude.
  it("matches the reference pair for black text on white", () => {
    expect(lc("#000000", "#ffffff")).toBeCloseTo(106.04, 1)
  })

  it("matches the reference pair for white text on black, and reports it negative", () => {
    expect(lc("#ffffff", "#000000")).toBeCloseTo(-107.88, 1)
  })

  it("matches the reference pairs for mid grey in both polarities", () => {
    expect(lc("#888888", "#ffffff")).toBeCloseTo(63.06, 1)
    expect(lc("#ffffff", "#888888")).toBeCloseTo(-68.54, 1)
  })

  it("reads oklch strings as well as hex", () => {
    expect(lc("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(106.04, 1)
  })

  it("returns zero below the minimum luminance difference", () => {
    expect(lc("#777777", "#777777")).toBe(0)
    expect(lc("#777777", "#777778")).toBe(0)
  })

  it("returns zero for a colour that does not parse, so a half-typed hex fails every floor", () => {
    expect(lc("#12", "#ffffff")).toBe(0)
  })
})

describe("floors and the dead zone", () => {
  it("gets stricter as the text gets smaller", () => {
    expect(LC_FLOORS.bodySmall).toBeGreaterThan(LC_FLOORS.body)
    expect(LC_FLOORS.body).toBeGreaterThan(LC_FLOORS.secondary)
    expect(LC_FLOORS.secondary).toBeGreaterThan(LC_FLOORS.disabled)
  })

  it("covers L 0.68 to 0.76 inclusive", () => {
    expect(inDeadZone(0.679)).toBe(false)
    expect(inDeadZone(0.68)).toBe(true)
    expect(inDeadZone(0.72)).toBe(true)
    expect(inDeadZone(0.76)).toBe(true)
    expect(inDeadZone(0.761)).toBe(false)
  })

  it("is where neither label works, which is why the band exists", () => {
    const fill = formatOklch({ l: 0.72, c: 0, h: 0 })
    expect(Math.abs(lc("#ffffff", fill))).toBeLessThan(LC_FLOORS.body)
    expect(Math.abs(lc("#000000", fill))).toBeLessThan(LC_FLOORS.body)
  })
})
