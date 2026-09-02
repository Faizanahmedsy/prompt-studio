/**
 * Resolving a chosen theme into the values a stylesheet is written from.
 *
 * The layering is the whole point. A preset supplies every colour; the project
 * stores only what the user changed on top of it. Resolving in that order is
 * what lets a preset be improved later and reach a project that was created
 * months ago — a project that had stored its whole resolved palette would be
 * frozen at the day somebody first opened it.
 *
 * Everything that can be derived is derived here rather than stored: the type
 * scale from one ratio, the spacing steps, the single shadow the elevation
 * strategy allows, the two durations and the curve. Storing them would mean two
 * places to change and the second one is always the one that gets forgotten.
 *
 * `vividness` and `neutralHue` are deliberately not applied again here. The
 * preset's records are already at the preset's chroma, and the editor writes a
 * change to either dial through the colour module into `palette` overrides.
 * Re-deriving them at this point would apply the same dial twice and quietly
 * move colours somebody had already corrected by hand.
 */

import { parseOklch } from "@/features/theme/color/oklch"
import { type Preset, presetById } from "@/features/theme/data/presets"
import { themeSchema, type Theme } from "@/types/project"

/**
 * The shadcn token names, in the order a stylesheet declares them.
 *
 * Grouped rather than flat because the groups become the blank lines in the
 * generated file, and thirty-one unbroken lines of custom properties is the
 * difference between a file someone reads and one they scroll past.
 *
 * There is no `--destructive-foreground`: current shadcn does not have one, and
 * emitting it would send an agent looking for the component that consumes it.
 */
export const tokenGroups: readonly (readonly string[])[] = [
  ["background", "foreground"],
  ["card", "card-foreground", "popover", "popover-foreground"],
  ["primary", "primary-foreground", "secondary", "secondary-foreground"],
  ["muted", "muted-foreground", "accent", "accent-foreground"],
  ["destructive"],
  ["border", "input", "ring"],
  ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  [
    "sidebar",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-primary-foreground",
    "sidebar-accent",
    "sidebar-accent-foreground",
    "sidebar-border",
    "sidebar-ring",
  ],
]

export const tokenNames: readonly string[] = tokenGroups.flatMap((group) => [...group])

export type TypeStepName = "display" | "h1" | "h2" | "h3" | "body" | "small" | "micro"

export type TypeStep = {
  name: TypeStepName
  /** whole px — half a pixel renders differently on every platform */
  size: number
  /** unitless, so it survives being inherited */
  lineHeight: number
  /** in em with its sign, ready to paste — "-0.018em" */
  tracking: string
  weight: number
}

export type MotionTokens = {
  model: Theme["motionModel"]
  /** a state change on a control: hover, focus, press, check */
  stateMs: number
  /** something entering or leaving: menu, dialog, toast */
  enterMs: number
  /** the one curve everything uses; "" when nothing moves */
  curve: string
  /** reserved for the two or three playful moments; "" unless a spring */
  overshoot: string
  /** the spring itself, for the runtimes that animate with physics */
  spring: { stiffness: number; damping: number; mass: number } | null
}

export type ElevationTokens = {
  strategy: Theme["elevationStrategy"]
  /** the ONE shadow, or "" when depth is carried some other way */
  shadow: string
  /** px of backdrop blur; 0 unless the strategy is glass */
  blur: number
  /** one sentence naming what carries depth, for the prompt and the file */
  rule: string
}

export type TokenSet = {
  light: Record<string, string>
  dark: Record<string, string>
  shape: Theme["shape"]
  /** real family names, or "" where the character has not been pinned to one */
  fonts: Theme["fonts"]
  scaleRatio: number
  scale: TypeStep[]
  /** the only spacing values anything in the generated project may use */
  spacing: number[]
  motion: MotionTokens
  elevation: ElevationTokens
}

/** Body text is the fixed point; every other size is derived from it. */
const BODY_SIZE = 16

const SPACING = [4, 8, 12, 16, 24, 32, 48, 64]

/**
 * Weight is part of the step, not a separate decision.
 *
 * Micro is heavier than body on purpose: at eleven or twelve pixels a regular
 * weight loses more contrast than the size loses attention, and every design
 * system that skips this ends up with unreadable table labels.
 */
const WEIGHTS: Record<TypeStepName, number> = {
  display: 700,
  h1: 700,
  h2: 600,
  h3: 600,
  body: 400,
  small: 400,
  micro: 500,
}

const STEP_ORDER: readonly TypeStepName[] = [
  "display",
  "h1",
  "h2",
  "h3",
  "body",
  "small",
  "micro",
]

const round = (value: number, places: number) => Number(value.toFixed(places))

/** Big type needs less leading than small type, and never less than the cap. */
function lineHeightFor(size: number): number {
  return round(Math.min(1.7, 1.08 + 6.4 / size), 2)
}

/**
 * Tracking tightens as size grows and turns slightly positive at the smallest
 * step.
 *
 * That inverse relationship is the one typographic move a generated interface
 * never makes: display type set at its default spacing reads loose and cheap,
 * and eleven-pixel labels set at zero read cramped. The curve below is a plain
 * reciprocal, which crosses zero just under body size and settles around
 * -0.033em at poster sizes — the same shape a person would arrive at by eye.
 */
function trackingFor(size: number): string {
  return `${round(0.512 / size - 0.0327, 4)}em`
}

/**
 * The type scale.
 *
 * The ratio is a *heading* ratio. Applied downwards it collapses — 1.6 from
 * 16px reaches 6px in two steps — so the two sizes below body use a damped one.
 * Nobody sets a caption by the interval they set a hero at.
 */
function typeScale(ratio: number): TypeStep[] {
  const down = 1 + (ratio - 1) * 0.4
  const raw: Record<TypeStepName, number> = {
    display: BODY_SIZE * ratio ** 4,
    h1: BODY_SIZE * ratio ** 3,
    h2: BODY_SIZE * ratio ** 2,
    h3: BODY_SIZE * ratio,
    body: BODY_SIZE,
    small: BODY_SIZE / down,
    micro: BODY_SIZE / (down * down),
  }

  // Rounding to whole pixels collides at the shallow end of the range — a 1.05
  // ratio puts three steps on 17px. Walking outwards from body and forcing a
  // pixel of daylight is what keeps a scale a scale.
  const size = { ...raw }
  let previous = BODY_SIZE
  for (const name of ["h3", "h2", "h1", "display"] as const) {
    size[name] = Math.max(Math.round(raw[name]), previous + 1)
    previous = size[name]
  }
  previous = BODY_SIZE
  for (const name of ["small", "micro"] as const) {
    size[name] = Math.min(Math.round(raw[name]), previous - 1)
    previous = size[name]
  }
  size.body = BODY_SIZE

  return STEP_ORDER.map((name) => ({
    name,
    size: size[name],
    lineHeight: lineHeightFor(size[name]),
    tracking: trackingFor(size[name]),
    weight: WEIGHTS[name],
  }))
}

function motionTokens(model: Theme["motionModel"]): MotionTokens {
  switch (model) {
    case "none":
      return { model, stateMs: 0, enterMs: 0, curve: "", overshoot: "", spring: null }
    case "spring":
      return {
        model,
        // A spring has no duration, but half the surfaces it drives are CSS,
        // so it carries the durations that read as the same movement.
        stateMs: 140,
        enterMs: 260,
        curve: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        spring: { stiffness: 220, damping: 26, mass: 1 },
      }
    default:
      return {
        model: "duration",
        stateMs: 120,
        enterMs: 200,
        curve: "cubic-bezier(0.2, 0, 0, 1)",
        overshoot: "",
        spring: null,
      }
  }
}

/**
 * One shadow, never a five-step ramp.
 *
 * A ramp is the tell of a generated design: nothing in a real interface is at
 * elevation four, and offering five levels guarantees three of them are used
 * for decoration. Four of the seven strategies emit no shadow at all, because
 * depth carried by a surface step or a hairline is a different design, not a
 * quieter version of the same one.
 */
function elevationTokens(
  strategy: Theme["elevationStrategy"],
  brandHue: number
): ElevationTokens {
  const hue = round(brandHue, 1)
  switch (strategy) {
    case "shadow":
      return {
        strategy,
        shadow: "0 1px 2px oklch(0 0 0 / 0.05), 0 8px 24px -12px oklch(0 0 0 / 0.18)",
        blur: 0,
        rule: "Depth is one shadow, and it belongs only on something genuinely floating above the page — a menu, a dialog, a toast. Cards do not have it.",
      }
    case "ladder":
      return {
        strategy,
        shadow: "",
        blur: 0,
        rule: "Depth is a step in surface lightness — background, then card, then popover. Nothing casts a shadow; if two surfaces need separating, the one in front is lighter.",
      }
    case "hairline":
      return {
        strategy,
        shadow: "",
        blur: 0,
        rule: "Depth is a single hairline border. Nothing casts a shadow, and no border is thicker than 1px except the one carrying a selected state.",
      }
    case "grid":
      return {
        strategy,
        shadow: "",
        blur: 0,
        rule: "Depth is the rule grid: cells share their borders and the page reads as one ruled sheet. Nothing casts a shadow and nothing floats free of the grid.",
      }
    case "tinted":
      return {
        strategy,
        // Tinted toward the brand hue rather than neutral black, which is what
        // stops a shadow reading as dirt on a coloured ground.
        shadow: `0 1px 2px oklch(0.55 0.05 ${hue} / 0.1), 0 10px 30px -14px oklch(0.5 0.14 ${hue} / 0.4)`,
        blur: 0,
        rule: "Depth is one shadow tinted toward the brand hue, never neutral black. It belongs only on something genuinely floating above the page.",
      }
    case "glass":
      return {
        strategy,
        shadow: "",
        blur: 16,
        rule: "Depth is the blur behind an overlay: a translucent surface over a backdrop filter. It applies only where content genuinely passes underneath — a frosted panel with nothing behind it is decoration.",
      }
    default:
      return {
        strategy: "offset",
        // `var(--foreground)` rather than a literal so one value works in both
        // modes; the non-CSS targets resolve it per mode when they emit.
        shadow: "4px 4px 0 0 var(--foreground)",
        blur: 0,
        rule: "Depth is a hard offset with no blur, in the foreground colour. One offset distance everywhere, and it moves to 2px on press rather than fading.",
      }
  }
}

/**
 * The hue of the brand colour, for the one strategy that tints its shadow.
 *
 * A primary written in a notation the colour module does not read falls back to
 * the theme's own neutral hue, which is a defensible answer — a shadow tinted
 * toward the palette's bias is still a tinted shadow. Guessing would not be.
 */
function hueOf(color: string | undefined, fallback: number): number {
  return parseOklch(color ?? "")?.h ?? fallback
}

/**
 * Preset values first, then the project's overrides on top.
 *
 * The canonical order is re-imposed here so every generated file declares its
 * tokens in the same sequence whatever order a preset happened to list them in,
 * and anything a preset added beyond the shadcn set survives at the end rather
 * than being silently dropped.
 */
function layer(
  base: Record<string, string> | undefined,
  overrides: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = { ...(base ?? {}), ...overrides }
  const resolved: Record<string, string> = {}
  for (const name of tokenNames) if (merged[name]) resolved[name] = merged[name]
  for (const name of Object.keys(merged).sort()) {
    if (!resolved[name] && merged[name]) resolved[name] = merged[name]
  }
  return resolved
}

/**
 * A face is named only where somebody actually pinned one.
 *
 * An empty name means "follow the character", and the character reaches the
 * agent through the prompt rather than through the stylesheet — so the token
 * gets a system stack instead of a family the project has no licence to load.
 * `bodyFont: "pair"` is the schema's way of saying body follows the heading,
 * and it is the default, which is why it is honoured here rather than left to
 * each emitter to remember.
 */
function resolveFonts(theme: Theme, preset: Preset | undefined): Theme["fonts"] {
  const display = theme.fonts.display || preset?.fonts.display || ""
  const mono = theme.fonts.mono || preset?.fonts.mono || ""
  const named = theme.fonts.body || preset?.fonts.body || ""
  return { display, body: named || (theme.bodyFont === "pair" ? display : ""), mono }
}

/**
 * The schema's own defaults, read once rather than restated.
 *
 * A field still sitting on its default has not been decided by anyone, so the
 * preset gets to decide it. A field that has moved was moved deliberately and
 * survives a preset change — which is also why picking a preset in the editor
 * writes its values onto the document rather than relying on this.
 *
 * The known cost: setting a value that happens to equal the default reads as
 * "not decided". It is the same trade the serializer already makes when it
 * omits defaults from the Flow output, so at least the two agree.
 */
const THEME_DEFAULTS = themeSchema.parse({})

function deviates<K extends keyof Theme>(key: K, value: Theme[K]): boolean {
  return JSON.stringify(value) !== JSON.stringify(THEME_DEFAULTS[key])
}

/**
 * `preview` exists for the editor, which has to render a preset the project has
 * not switched to yet — hovering a card must not write to the document.
 */
export function resolveTokens(theme: Theme, preview?: Preset): TokenSet {
  const preset = preview ?? presetById(theme.preset)
  const light = layer(preset?.light, theme.palette.light)
  const dark = layer(preset?.dark, theme.palette.dark)

  // Structural fields follow the preset unless the document has moved them,
  // exactly as the colours do. Without this, naming a preset in Flow — the one
  // path that sets `preset` without going through the editor — produced a
  // project wearing one design's palette and another's geometry.
  const shape = deviates("shape", theme.shape) ? theme.shape : (preset?.shape ?? theme.shape)
  const scaleRatio = deviates("scaleRatio", theme.scaleRatio)
    ? theme.scaleRatio
    : (preset?.scaleRatio ?? theme.scaleRatio)
  const elevationStrategy = deviates("elevationStrategy", theme.elevationStrategy)
    ? theme.elevationStrategy
    : (preset?.elevationStrategy ?? theme.elevationStrategy)
  const motionModel = deviates("motionModel", theme.motionModel)
    ? theme.motionModel
    : (preset?.motionModel ?? theme.motionModel)
  const neutralHue = deviates("neutralHue", theme.neutralHue)
    ? theme.neutralHue
    : (preset?.neutralHue ?? theme.neutralHue)

  return {
    light,
    dark,
    shape: { ...shape },
    fonts: resolveFonts(theme, preset),
    scaleRatio,
    scale: typeScale(scaleRatio),
    spacing: [...SPACING],
    motion: motionTokens(motionModel),
    elevation: elevationTokens(elevationStrategy, hueOf(light.primary, neutralHue)),
  }
}
