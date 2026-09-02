"use client"

/**
 * The full-page design editor.
 *
 * This is now the only place design is edited. There used to be a second
 * editor — a sidebar of selects, rendered both in the inspector and behind the
 * floating bar — writing an overlapping set of fields, which is how a project
 * ended up describing one design in its prompt and rendering another in its
 * preview. Choosing a design needs the result at a size you can judge, so the
 * sidebar version was the one to lose.
 *
 * It is a work mode rather than a route on purpose. Every cloud hook — sync,
 * sharing, presence, and the read-only guard — is mounted inside Workbench, so
 * a route would either need all of them rewired or would quietly bypass them,
 * and the one it would bypass is the guard that stops a public viewer editing
 * a stranger's project.
 *
 * Every write goes through `useProjectStore.update`, which is where that guard
 * lives. Nothing here calls `setState` directly.
 */

import { Check, Contrast, RotateCcw, Shuffle } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { ColorField, SelectField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { LC_FLOORS, lc } from "@/features/theme/color/apca"
import {
  bodyFamilies,
  displayFamilies,
  type FontFamily,
  monoFamilies,
  randomPair,
} from "@/features/theme/data/font-families"
import { type Preset, presetById, presets } from "@/features/theme/data/presets"
import { resolveTokens } from "@/features/theme/tokens"
import { cn } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import {
  elevationStrategyValues,
  inputStyleValues,
  motionModelValues,
  type Project,
  type Theme,
  themeSchema,
} from "@/types/project"

import { type PreviewScreen, previewScreens, ThemePreview } from "./theme-preview"
import { useWebFonts } from "./use-web-fonts"

/**
 * What "default" means, taken from the schema rather than restated.
 *
 * Re-listing the fields here would drift the moment one is added — which is
 * exactly how `density` ended up shipping with a default nobody could reach.
 */
const DEFAULT_THEME: Theme = themeSchema.parse({})

/** The note is the whole reason the list is worth reading, so it goes in the label. */
const fontOptions = (families: FontFamily[]) =>
  families.map((family) => ({
    value: family.name,
    label: `${family.name} — ${family.note}`,
  }))

/**
 * The token list, grouped the way the shadcn table is.
 *
 * Grouped rather than alphabetical because the questions people actually have
 * are "what colour is a card" and "why is the sidebar wrong", not "what starts
 * with s".
 */
const TOKEN_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: "Base", keys: ["background", "foreground", "border", "input", "ring"] },
  { label: "Surfaces", keys: ["card", "card-foreground", "popover", "popover-foreground"] },
  {
    label: "Roles",
    keys: [
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive",
    ],
  },
  { label: "Charts", keys: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] },
  {
    label: "Sidebar",
    keys: [
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
    ],
  },
]

/** Pairs whose legibility actually decides whether a theme is usable. */
const CONTRAST_PAIRS: Array<[string, string, keyof typeof LC_FLOORS]> = [
  ["foreground", "background", "body"],
  ["card-foreground", "card", "body"],
  ["muted-foreground", "muted", "secondary"],
  ["primary-foreground", "primary", "body"],
  ["sidebar-foreground", "sidebar", "body"],
]

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </label>
  )
}

/**
 * The measured contrast of one pair, in APCA lightness contrast.
 *
 * Shown inline rather than behind a "check contrast" button, because a number
 * you have to ask for is a number nobody asks for.
 */
function ContrastBadge({
  text,
  bg,
  floor,
}: {
  text: string
  bg: string
  floor: number
}) {
  const measured = Math.round(Math.abs(lc(text, bg)))
  const passes = measured >= floor
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums",
        passes
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
      )}
      title={
        passes
          ? `Lc ${measured}, above the Lc ${floor} floor for this role`
          : `Lc ${measured} — below the Lc ${floor} floor. This text will be hard to read.`
      }
    >
      <Contrast className="size-2.5" />
      Lc {measured}
    </span>
  )
}

export function ThemeForge({ project }: { project: Project }) {
  const update = useProjectStore((state) => state.update)
  const theme = project.theme
  const [mode, setMode] = useState<"light" | "dark" | "both">("both")
  const [tokensOpen, setTokensOpen] = useState(false)
  // Which section is in view, so the buttons read as a position rather than a
  // filter. Scrolling updates it; clicking one scrolls.
  const [screen, setScreen] = useState<PreviewScreen>("app")
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Partial<Record<PreviewScreen, HTMLElement | null>>>({})

  const scrollTo = (id: PreviewScreen) => {
    setScreen(id)
    sectionRefs.current[id]?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost section that is actually on screen wins; without the
        // sort, whichever entry the browser reported last does, and the label
        // flickers between two neighbours mid-scroll.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const id = visible?.target.getAttribute("data-screen") as PreviewScreen | null
        if (id) setScreen(id)
      },
      { root, rootMargin: "0px 0px -60% 0px", threshold: 0 }
    )
    for (const node of Object.values(sectionRefs.current)) if (node) observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const [editing, setEditing] = useState<"light" | "dark">("light")

  const tokens = useMemo(() => resolveTokens(theme), [theme])
  useWebFonts([tokens.fonts.display, tokens.fonts.body, tokens.fonts.mono])
  const active = presetById(theme.preset)

  const set = (patch: Partial<Theme>) =>
    update(
      (doc) => {
        Object.assign(doc.theme, patch)
      },
      // Dragging a slider is one decision, not forty undo entries.
      { coalesce: "theme" }
    )

  /**
   * Choosing a preset clears the per-token overrides.
   *
   * Keeping them would silently mix half of one design into another and the
   * result is the muddle that makes people give up on theme editors.
   */
  const choosePreset = (id: string) => {
    const preset = presetById(id)
    set({
      preset: preset.id,
      palette: { light: {}, dark: {} },
      shape: { ...preset.shape },
      fonts: { ...preset.fonts },
      scaleRatio: preset.scaleRatio,
      vividness: preset.vividness,
      neutralHue: preset.neutralHue,
      elevationStrategy: preset.elevationStrategy,
      motionModel: preset.motionModel,
      inputStyle: preset.inputStyle,
      density: preset.density,
    })
  }

  /**
   * One undo entry, not forty: this deliberately does not go through `set`,
   * whose coalescing would fold the reset into whichever slider was dragged
   * last and make it un-undoable on its own.
   */
  const resetAll = () =>
    update((doc) => {
      doc.theme = structuredClone(DEFAULT_THEME)
    })

  const changed = JSON.stringify(theme) !== JSON.stringify(DEFAULT_THEME)
  const defaultPreset = presetById(DEFAULT_THEME.preset)

  const overrideCount =
    Object.keys(theme.palette.light).length + Object.keys(theme.palette.dark).length

  const setToken = (which: "light" | "dark", key: string, value: string) =>
    set({
      palette: {
        ...theme.palette,
        [which]: { ...theme.palette[which], [key]: value },
      },
    })

  return (
    <div className="flex h-full min-h-0">
      {/* ---------------------------------------------------------- controls */}
      <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">Design</h2>
            <p className="text-xs text-muted-foreground">
              Chosen once, then every screen and the generated prompt follow it.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!changed}
            onClick={resetAll}
            title={
              changed
                ? `Put every design value back to the default (${defaultPreset.name})`
                : "Already at the defaults"
            }
            className="h-7 shrink-0 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Reset all
          </Button>
        </div>

        <div className="flex flex-col gap-5 p-4">
          <section className="flex flex-col gap-2">
            <SectionLabel>Preset</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset: Preset) => {
                const chosen = preset.id === theme.preset
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => choosePreset(preset.id)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-lg border p-2.5 text-left transition-colors",
                      chosen
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold">{preset.name}</span>
                      {chosen && <Check className="size-3 text-primary" />}
                    </span>
                    {/* The swatch row is three tokens, not one: a single dot
                        makes every preset look like a hue rotation, which is
                        the exact impression to avoid. */}
                    <span className="flex gap-1">
                      {["primary", "background", "muted", "chart-2"].map((key) => (
                        <span
                          key={key}
                          className="size-3 rounded-full border border-border/60"
                          style={{ background: preset.light[key] }}
                        />
                      ))}
                    </span>
                    <span className="text-[10px] leading-tight text-muted-foreground">
                      {preset.character}
                    </span>
                  </button>
                )
              })}
            </div>
            {overrideCount > 0 && (
              <button
                type="button"
                onClick={() => choosePreset(theme.preset)}
                className="flex items-center gap-1.5 self-start text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                Reset {overrideCount} custom {overrideCount === 1 ? "value" : "values"} back to{" "}
                {active.name}
              </button>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Colour</SectionLabel>
            <Slider
              label="Vividness"
              value={theme.vividness}
              min={0}
              max={100}
              unit="%"
              onChange={(vividness) => set({ vividness })}
            />
            <Slider
              label="Neutral hue"
              value={theme.neutralHue}
              min={0}
              max={360}
              unit="°"
              onChange={(neutralHue) => set({ neutralHue })}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Vividness is a share of what the hue can actually reach in sRGB, so
              turning it up never pushes a colour out of gamut. The neutral hue
              biases every grey toward the accent — a pure grey beside them reads
              as an accident.
            </p>
            <ColorField
              label="Primary"
              value={theme.primaryColor}
              onChange={(primaryColor) => set({ primaryColor })}
            />
            <ColorField
              label="Secondary"
              value={theme.secondaryColor}
              onChange={(secondaryColor) => set({ secondaryColor })}
            />
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Shape</SectionLabel>
            <Slider
              label="Controls"
              value={theme.shape.control}
              min={0}
              max={24}
              unit="px"
              onChange={(control) => set({ shape: { ...theme.shape, control } })}
            />
            <Slider
              label="Cards"
              value={theme.shape.card}
              min={0}
              max={32}
              unit="px"
              onChange={(card) => set({ shape: { ...theme.shape, card } })}
            />
            <Slider
              label="Overlays"
              value={theme.shape.overlay}
              min={0}
              max={40}
              unit="px"
              onChange={(overlay) => set({ shape: { ...theme.shape, overlay } })}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={theme.shape.pill}
                onChange={(event) =>
                  set({ shape: { ...theme.shape, pill: event.target.checked } })
                }
                className="size-3.5 accent-primary"
              />
              <span>Actions are pills, whatever the control radius says</span>
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Type</SectionLabel>
            <Slider
              label="Scale ratio"
              value={theme.scaleRatio}
              min={1.05}
              max={1.7}
              step={0.01}
              onChange={(scaleRatio) => set({ scaleRatio })}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Tracking is computed from the resulting sizes, tightening as they
              grow and going slightly positive at the smallest step. That inverse
              relationship is the clearest signal a person set the type.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Typefaces</SectionLabel>
              <button
                type="button"
                onClick={() => set({ fonts: randomPair() })}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                title="Draw a display face, then a body face from a different category"
              >
                <Shuffle className="size-3" />
                Shuffle
              </button>
            </div>
            <SelectField
              label="Display"
              value={tokens.fonts.display}
              onValueChange={(display) =>
                set({ fonts: { ...tokens.fonts, display } })
              }
              options={fontOptions(displayFamilies)}
            />
            <SelectField
              label="Body"
              value={tokens.fonts.body}
              onValueChange={(body) => set({ fonts: { ...tokens.fonts, body } })}
              options={fontOptions(bodyFamilies)}
            />
            <SelectField
              label="Mono"
              value={tokens.fonts.mono}
              onValueChange={(mono) => set({ fonts: { ...tokens.fonts, mono } })}
              options={fontOptions(monoFamilies)}
            />
            <p
              className="text-[13px] leading-snug text-muted-foreground"
              style={{ fontFamily: `"${tokens.fonts.body}", system-ui, sans-serif` }}
            >
              Every family is on Google Fonts, so the generated project can
              actually load the face rather than naming one it has no licence
              for. This line is set in {tokens.fonts.body}.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Spacing</SectionLabel>
            <SelectField
              label="Density"
              value={theme.density}
              onValueChange={(value) =>
                set({ density: value as Theme["density"] })
              }
              options={[
                { value: "compact", label: "compact" },
                { value: "comfortable", label: "comfortable" },
                { value: "spacious", label: "spacious" },
              ]}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              One padding and one gap, and every other measure in the interface
              is a multiple of those two. Compact is a work surface someone keeps
              open all day; spacious is a page they read.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Depth &amp; motion</SectionLabel>
            <SelectField
              label="Elevation carried by"
              value={theme.elevationStrategy}
              onValueChange={(value) =>
                set({ elevationStrategy: value as Theme["elevationStrategy"] })
              }
              options={elevationStrategyValues.map((id) => ({ value: id, label: id }))}
            />
            <SelectField
              label="Text fields"
              value={theme.inputStyle}
              onValueChange={(value) => {
                set({ inputStyle: value as Theme["inputStyle"] })
                // Pointless to change a field treatment while looking at a
                // dashboard, so the preview goes where the change is visible.
                scrollTo("form")
              }}
              options={inputStyleValues.map((id) => ({ value: id, label: id }))}
            />
            <SelectField
              label="Motion"
              value={theme.motionModel}
              onValueChange={(value) => set({ motionModel: value as Theme["motionModel"] })}
              options={motionModelValues.map((id) => ({ value: id, label: id }))}
            />
          </section>

          <section className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setTokensOpen((open) => !open)}
              className="flex items-center justify-between text-left"
            >
              <SectionLabel>Every token</SectionLabel>
              <span className="text-[11px] text-muted-foreground">
                {tokensOpen ? "Hide" : `${TOKEN_GROUPS.flatMap((g) => g.keys).length} values`}
              </span>
            </button>
            {tokensOpen && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-1">
                  {(["light", "dark"] as const).map((one) => (
                    <Button
                      key={one}
                      size="sm"
                      variant={editing === one ? "secondary" : "ghost"}
                      onClick={() => setEditing(one)}
                      className="h-6 flex-1 px-2 text-[11px] capitalize"
                    >
                      {one}
                    </Button>
                  ))}
                </div>
                {TOKEN_GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {group.label}
                    </span>
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tokens[editing][key] ?? ""}
                          onChange={(event) => setToken(editing, key, event.target.value)}
                          spellCheck={false}
                          className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-1 font-mono text-[10px]"
                          aria-label={`--${key} in ${editing} mode`}
                        />
                        <span
                          className="size-5 shrink-0 rounded border border-border"
                          style={{ background: tokens[editing][key] }}
                        />
                        <span className="w-[104px] shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                          {key}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <SectionLabel>Legibility</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {CONTRAST_PAIRS.map(([text, bg, role]) => (
                <div key={text} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {text} on {bg}
                  </span>
                  <span className="flex gap-1">
                    <ContrastBadge
                      text={tokens.light[text]}
                      bg={tokens.light[bg]}
                      floor={LC_FLOORS[role]}
                    />
                    <ContrastBadge
                      text={tokens.dark[text]}
                      bg={tokens.dark[bg]}
                      floor={LC_FLOORS[role]}
                    />
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Light then dark, measured in APCA. Dark mode has less than half the
              tonal room light mode has, which is why the two are authored
              separately rather than inverted.
            </p>
          </section>
        </div>

        {/* ------------------------------------------------------ what next */}
        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-border bg-card p-4">
          <p className="text-[11px] leading-snug text-muted-foreground">
            There is no save button — every change here is written to the
            project as you make it, and the badge in the header says whether it
            has reached the server yet. This design is what every screen and the
            generated prompt follow.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => useUiStore.getState().setMode("web")}
            >
              Done — back to the canvas
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Then draw your screens, and use <strong>Copy prompt</strong> in the
            header when you want the build prompt.
          </p>
        </div>
      </aside>

      {/* ----------------------------------------------------------- preview */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/30">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold">{active.name}</span>
            <span className="text-[11px] text-muted-foreground">{active.character}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {previewScreens.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={screen === option.id ? "secondary" : "ghost"}
                onClick={() => scrollTo(option.id)}
                className="h-7 px-2.5 text-xs"
              >
                {option.label}
              </Button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {(["light", "dark", "both"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={mode === option ? "secondary" : "ghost"}
                onClick={() => setMode(option)}
                className="h-7 px-2.5 text-xs capitalize"
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        {/*
          Every screen is on the page, one after another, and the buttons above
          scroll to them. Tabs hid four fifths of the theme behind a click, and
          the thing you most want to know about a design — whether it holds
          together across a dashboard, a form and a landing page — is exactly
          what you cannot see when you can only look at one at a time.
        */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth p-4">
          <div className="flex flex-col gap-8">
            {previewScreens.map((one) => (
              <section
                key={one.id}
                ref={(node) => {
                  sectionRefs.current[one.id] = node
                }}
                // Sits above the section so a jump does not tuck the heading
                // under the sticky bar it just scrolled out from behind.
                className="flex scroll-mt-4 flex-col gap-2"
                data-screen={one.id}
                aria-label={`${one.label} preview`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold">{one.label}</h3>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div
                  className={cn(
                    "grid gap-4",
                    mode === "both" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
                  )}
                >
                  {(mode === "both" ? (["light", "dark"] as const) : [mode]).map((tone) => (
                    <div key={tone} className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {tone}
                      </span>
                      <ThemePreview
                        tokens={tokens}
                        mode={tone}
                        screen={one.id}
                        density={theme.density}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
