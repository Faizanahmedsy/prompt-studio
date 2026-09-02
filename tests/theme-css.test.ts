import { describe, expect, it } from "vitest"

import { stackGroups } from "@/features/stack/data/stack-catalogue"
import type { Preset } from "@/features/theme/data/presets"
import { generateStylesheet, resolveTokens, tokenNames } from "@/features/theme/tokens"
import { type Theme, themeSchema } from "@/types/project"

/**
 * The generator is exercised against a fixture rather than a shipped preset.
 *
 * A test that asserts on the real presets fails every time somebody improves
 * one, which trains people to stop reading it. What is being checked here is
 * the machine — layering, derivation, and what each stack can actually parse —
 * so the palette it runs on only has to be distinct per token.
 */
const palette = (mode: "light" | "dark"): Record<string, string> =>
  Object.fromEntries(
    tokenNames.map((name, index) => [
      name,
      `oklch(${(mode === "light" ? 0.95 - index * 0.015 : 0.2 + index * 0.015).toFixed(3)} 0.0${
        (index % 9) + 1
      } ${(index * 11) % 360})`,
    ])
  )

const fixture: Preset = {
  id: "fixture",
  name: "Fixture",
  character: "a fixture, not a design",
  axes: ["quiet", "editorial"],
  fonts: { display: "Sora", body: "Inter", mono: "JetBrains Mono" },
  scaleRatio: 1.25,
  shape: { control: 10, card: 16, overlay: 20, pill: false },
  density: "comfortable",
  elevationStrategy: "shadow",
  motionModel: "duration",
  neutralHue: 260,
  vividness: 60,
  light: palette("light"),
  dark: palette("dark"),
  promptDetails: "A fixture preset used only by the token tests.",
}

/** The same fixture with nothing pinned to a real family. */
const unnamedFonts: Preset = { ...fixture, fonts: { display: "", body: "", mono: "" } }

const themeWith = (patch: Record<string, unknown> = {}): Theme =>
  themeSchema.parse({ preset: "fixture", ...patch })

const stylingIds = (
  stackGroups.find((group) => group.key === "styling")?.options ?? []
).map((option) => option.id)

/** The declaration block for one selector, without the nested ones. */
function blockOf(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  expect(start, `${selector} is missing`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf("\n}", start)
  return source.slice(start, end)
}

const firstMeaningfulLine = (source: string) =>
  source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("/*") && !line.startsWith("*"))[0]

describe("the token names", () => {
  it("is the current shadcn set, with no --destructive-foreground", () => {
    // Named in full rather than counted: a missing token is the failure this
    // catches, and a count would still pass if one were swapped for another.
    expect([...tokenNames]).toEqual([
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
    ])
    expect(tokenNames).not.toContain("destructive-foreground")
  })
})

describe("the Tailwind v4 stylesheet", () => {
  const sheet = generateStylesheet(themeWith(), "tailwind4-shadcn", fixture)

  it("is written where this stack already imports it from", () => {
    expect(sheet.path).toBe("app/globals.css")
    expect(sheet.language).toBe("css")
  })

  it("starts with Tailwind's own import when no face is named", () => {
    const bare = generateStylesheet(themeWith(), "tailwind4-shadcn", unnamedFonts)
    expect(firstMeaningfulLine(bare.source)).toBe('@import "tailwindcss";')
    expect(bare.source).not.toContain("fonts.googleapis.com")
  })

  it("puts the font request first when there is one", () => {
    // An @import after any rule is invalid and dropped silently, which is how a
    // design ships in the fallback face and nobody notices for a week.
    const first = firstMeaningfulLine(sheet.source)
    expect(first).toMatch(/^@import url\("https:\/\/fonts\.googleapis\.com/)
    expect(first).toContain("family=Sora")
    expect(first).toContain("family=Inter")
    expect(sheet.source.indexOf("fonts.googleapis.com")).toBeLessThan(
      sheet.source.indexOf('@import "tailwindcss"')
    )
  })

  it("carries the shadcn blocks a v4 project expects", () => {
    expect(sheet.source).toContain("@custom-variant dark (&:is(.dark *));")
    expect(sheet.source).toContain("@theme inline {")
    expect(sheet.source).toContain("@apply border-border outline-ring/50;")
    expect(sheet.source).toContain("@apply bg-background text-foreground")
    expect(sheet.source).toContain("--color-background: var(--background);")
    expect(sheet.source).not.toMatch(/undefined|NaN/)
  })

  it("declares every token in both modes", () => {
    const light = blockOf(sheet.source, ":root")
    const dark = blockOf(sheet.source, ".dark")
    for (const name of tokenNames) {
      expect(light, `--${name} missing from :root`).toContain(`--${name}:`)
      expect(dark, `--${name} missing from .dark`).toContain(`--${name}:`)
    }
  })

  it("emits four radii rather than one scalar with multipliers", () => {
    const light = blockOf(sheet.source, ":root")
    expect(light).toContain("--radius-control: 10px;")
    expect(light).toContain("--radius-card: 16px;")
    expect(light).toContain("--radius-overlay: 20px;")
    expect(light).toContain("--radius-action: 10px;")

    const pill = generateStylesheet(
      themeWith({ shape: { control: 10, card: 16, overlay: 20, pill: true } }),
      "tailwind4-shadcn",
      fixture
    )
    expect(blockOf(pill.source, ":root")).toContain("--radius-action: 9999px;")
    // Square everywhere and still pill on the actions — the thing one scalar
    // could never say.
    expect(blockOf(pill.source, ":root")).toContain("--radius-control: 10px;")
  })

  it("closes every block it opens", () => {
    for (const id of stylingIds) {
      const one = generateStylesheet(themeWith(), id, fixture)
      if (one.language !== "css") continue
      const opens = (one.source.match(/{/g) ?? []).length
      const closes = (one.source.match(/}/g) ?? []).length
      expect(closes, `${id} does not balance`).toBe(opens)
    }
  })
})

describe("the stacks that cannot evaluate a colour function", () => {
  it("gives NativeWind literals only", () => {
    const sheet = generateStylesheet(themeWith(), "nativewind", fixture)
    expect(sheet.path).toBe("global.css")
    expect(sheet.source).not.toContain("oklch(")
    expect(sheet.source).not.toContain("color-mix(")
    expect(sheet.source).toMatch(/--background: #[0-9a-f]{6}/)
  })

  it("gives Tailwind v3 the bare triplets its config consumes", () => {
    const sheet = generateStylesheet(themeWith(), "tailwind3-shadcn", fixture)
    expect(sheet.source).not.toContain("oklch(")
    expect(sheet.source).toMatch(/--background: [\d.]+ [\d.]+% [\d.]+%;/)
    expect(sheet.source).toContain('"background": "hsl(var(--background))"')
  })

  it("gives MUI hex, both themes and one shadow ramp", () => {
    const sheet = generateStylesheet(themeWith(), "mui", fixture)
    expect(sheet.path).toBe("styles/theme.ts")
    expect(sheet.language).toBe("ts")
    expect(sheet.source).toContain("createTheme({")
    expect(sheet.source).toContain("export const darkTheme")
    expect(sheet.source).toMatch(/main: "#[0-9a-f]{6}"/)
    expect(sheet.source).not.toContain("oklch(")
  })
})

describe("layering", () => {
  const base = resolveTokens(themeWith(), fixture)
  const overridden = resolveTokens(
    themeWith({ palette: { light: { primary: "oklch(0.61 0.2 21)" }, dark: {} } }),
    fixture
  )

  it("lets an override win for its own key and nothing else", () => {
    expect(base.light.primary).not.toBe("oklch(0.61 0.2 21)")
    expect(overridden.light.primary).toBe("oklch(0.61 0.2 21)")
    for (const name of tokenNames) {
      if (name === "primary") continue
      expect(overridden.light[name], `${name} moved`).toBe(base.light[name])
    }
    expect(overridden.dark).toEqual(base.dark)
  })

  it("reaches the stylesheet", () => {
    const sheet = generateStylesheet(
      themeWith({ palette: { light: { primary: "oklch(0.61 0.2 21)" }, dark: {} } }),
      "tailwind4-shadcn",
      fixture
    )
    expect(blockOf(sheet.source, ":root")).toContain("--primary: oklch(0.61 0.2 21);")
    expect(blockOf(sheet.source, ".dark")).toContain(`--primary: ${base.dark.primary};`)
  })
})

describe("the type scale", () => {
  for (const ratio of [1.05, 1.2, 1.25, 1.414, 1.7]) {
    it(`is a scale at ${ratio}`, () => {
      const { scale } = resolveTokens(themeWith({ scaleRatio: ratio }), fixture)
      expect(scale.map((step) => step.name)).toEqual([
        "display",
        "h1",
        "h2",
        "h3",
        "body",
        "small",
        "micro",
      ])

      for (let index = 1; index < scale.length; index += 1) {
        // Sizes fall from display to micro, and rounding never collapses two
        // steps onto the same pixel.
        expect(scale[index].size).toBeLessThan(scale[index - 1].size)
        expect(Number.isInteger(scale[index].size)).toBe(true)

        // Tracking is the tell: it tightens as size grows, so walking down the
        // scale it can only rise.
        const tracking = Number.parseFloat(scale[index].tracking)
        const previous = Number.parseFloat(scale[index - 1].tracking)
        expect(tracking).toBeGreaterThan(previous)

        expect(scale[index].lineHeight).toBeGreaterThanOrEqual(scale[index - 1].lineHeight)
      }

      // Positive at the smallest step, negative at the largest.
      expect(Number.parseFloat(scale[scale.length - 1].tracking)).toBeGreaterThan(0)
      expect(Number.parseFloat(scale[0].tracking)).toBeLessThan(0)
      expect(scale.find((step) => step.name === "body")?.size).toBe(16)
    })
  }

  it("is the same scale in the file", () => {
    const sheet = generateStylesheet(themeWith({ scaleRatio: 1.25 }), "tailwind4-shadcn", fixture)
    const { scale } = resolveTokens(themeWith({ scaleRatio: 1.25 }), fixture)
    for (const step of scale) {
      expect(sheet.source).toContain(`--text-${step.name}: ${step.size}px;`)
      expect(sheet.source).toContain(`--text-${step.name}--letter-spacing: ${step.tracking};`)
    }
  })
})

describe("spacing", () => {
  it("is the eight steps and nothing between them", () => {
    expect(resolveTokens(themeWith(), fixture).spacing).toEqual([4, 8, 12, 16, 24, 32, 48, 64])
  })
})

describe("elevation", () => {
  it("is one value, never a ramp", () => {
    const shadow = resolveTokens(themeWith({ elevationStrategy: "shadow" }), fixture).elevation
    expect(shadow.shadow).toBe(
      "0 1px 2px oklch(0 0 0 / 0.05), 0 8px 24px -12px oklch(0 0 0 / 0.18)"
    )
    expect(generateStylesheet(themeWith(), "tailwind4-shadcn", fixture).source).not.toMatch(
      /--shadow-2|--elevation-2|--shadow-lg/
    )
  })

  it("carries depth some other way where the strategy says so", () => {
    for (const strategy of ["hairline", "ladder", "grid"] as const) {
      const { elevation } = resolveTokens(themeWith({ elevationStrategy: strategy }), fixture)
      expect(elevation.shadow).toBe("")
      expect(elevation.rule.length).toBeGreaterThan(40)
      const sheet = generateStylesheet(themeWith({ elevationStrategy: strategy }), "tailwind4-shadcn", fixture)
      expect(sheet.source).not.toContain("--elevation:")
    }

    const glass = resolveTokens(themeWith({ elevationStrategy: "glass" }), fixture).elevation
    expect(glass.blur).toBeGreaterThan(0)
    expect(
      generateStylesheet(themeWith({ elevationStrategy: "glass" }), "tailwind4-shadcn", fixture)
        .source
    ).toContain("--glass-blur:")

    // A hard offset is an offset with no blur and no spread.
    const offset = resolveTokens(themeWith({ elevationStrategy: "offset" }), fixture).elevation
    expect(offset.shadow).toMatch(/^4px 4px 0 0 /)

    const tinted = resolveTokens(themeWith({ elevationStrategy: "tinted" }), fixture).elevation
    // The brand hue, read from the primary the preset actually shipped.
    expect(tinted.shadow).toContain(" 66 /")
  })
})

describe("motion", () => {
  it("gives the duration model two durations and one curve", () => {
    const { motion } = resolveTokens(themeWith({ motionModel: "duration" }), fixture)
    expect(motion.stateMs).toBe(120)
    expect(motion.enterMs).toBe(200)
    expect(motion.curve).toBe("cubic-bezier(0.2, 0, 0, 1)")
    expect(motion.overshoot).toBe("")
  })

  it("gives the spring model a spring and one overshoot curve", () => {
    const { motion } = resolveTokens(themeWith({ motionModel: "spring" }), fixture)
    expect(motion.spring).not.toBeNull()
    expect(motion.overshoot).toMatch(/^cubic-bezier/)
  })

  it("emits nothing at all when nothing moves", () => {
    const still = themeWith({ motionModel: "none" })
    for (const id of stylingIds) {
      const sheet = generateStylesheet(still, id, fixture)
      expect(sheet.source, `${id} carries a duration`).not.toMatch(/\d+ms\b/)
      expect(sheet.source, `${id} carries a curve`).not.toMatch(/cubic-bezier/)
      expect(sheet.source, `${id} carries keyframes`).not.toMatch(/@keyframes/)
      if (sheet.language === "css") {
        // In CSS there is nothing legitimate left to say about motion, so the
        // words themselves must be absent. A typed theme still needs its
        // framework's off switch, which is why that check is value-level.
        expect(sheet.source, `${id} declares motion`).not.toMatch(/transition/i)
        expect(sheet.source, `${id} declares motion`).not.toMatch(/animation/i)
      }
    }
  })
})

describe("every styling option in the catalogue", () => {
  it("is a real file with real contents", () => {
    expect(stylingIds.length).toBeGreaterThan(5)
    for (const id of stylingIds) {
      const sheet = generateStylesheet(themeWith(), id, fixture)
      expect(sheet.path, `${id} has no path`).not.toBe("")
      expect(sheet.source.trim().length, `${id} is empty`).toBeGreaterThan(200)
      expect(sheet.source, `${id} has a hole in it`).not.toMatch(/undefined|NaN/)
      // Whatever the target, the shape tokens have to survive into it.
      expect(sheet.source, `${id} lost the card radius`).toMatch(/16/)
    }
  })

  it("leaves a service with nothing to write", () => {
    const sheet = generateStylesheet(themeWith(), "", fixture)
    expect(sheet.source).toBe("")
    expect(sheet.path).toBe("")
  })
})
