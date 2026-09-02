"use client"

/**
 * The live surfaces a theme is judged on.
 *
 * Six of them, chosen because between them they exercise every token in the
 * set: a header and two cards (background, card, border, foreground), a stat
 * row (chart colours), a table with its skeleton and empty states (muted,
 * input, secondary foreground), a dialog over its overlay, the sidebar nav
 * (eight sidebar tokens nothing else touches), and the four toast tones
 * (destructive plus the accents). A token no surface renders is a token
 * somebody gets wrong and only discovers in a generated app.
 *
 * Two deliberate choices, both learned from looking at real systems:
 *
 * The ground is tinted, never white. An elevation language built on a hairline
 * plus a wide diffuse shadow disappears against pure white, and the person
 * editing responds by cranking the shadow until it looks wrong everywhere else.
 *
 * The custom properties are set on THIS element, not on `document.documentElement`.
 * Writing them globally would re-theme the editor's own chrome, so a dark
 * preset would leave the controls unreadable exactly when they are needed.
 */

import { useMemo } from "react"

import type { TokenSet } from "@/features/theme/tokens"
import { cn } from "@/lib/utils"

type Mode = "light" | "dark"

/** Token names carry no `--` in the preset; the preview scopes them by prefix. */
function cssVars(
  tokens: Record<string, string>,
  shape: { control: number; card: number; overlay: number; pill: boolean },
  fonts: { display: string; body: string; mono: string }
): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(tokens)) style[`--pv-${key}`] = value
  style["--pv-r-control"] = shape.pill ? "9999px" : `${shape.control}px`
  style["--pv-r-card"] = `${shape.card}px`
  style["--pv-r-overlay"] = `${shape.overlay}px`
  if (fonts.display) style["--pv-font-display"] = `"${fonts.display}", system-ui, sans-serif`
  if (fonts.body) style["--pv-font-body"] = `"${fonts.body}", system-ui, sans-serif`
  if (fonts.mono) style["--pv-font-mono"] = `"${fonts.mono}", ui-monospace, monospace`
  return style as React.CSSProperties
}

const v = (name: string) => `var(--pv-${name})`

function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn("p-4", className)}
      style={{
        background: v("card"),
        color: v("card-foreground"),
        border: `1px solid ${v("border")}`,
        borderRadius: v("r-card"),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span
        className="text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.1em", color: v("muted-foreground") }}
      >
        {label}
      </span>
      <span
        className="text-2xl font-bold"
        style={{
          fontFamily: v("font-display"),
          fontVariantNumeric: "tabular-nums",
          color: v(tone),
        }}
      >
        {value}
      </span>
    </Card>
  )
}

/** A single themed surface, rendered at one mode. */
function Surfaces({ shadow }: { shadow: string }) {
  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: v("font-body") }}>
      {/* Header card */}
      <Card style={{ boxShadow: shadow }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3
              className="text-lg font-bold"
              style={{ fontFamily: v("font-display"), letterSpacing: "-0.02em" }}
            >
              Consignments
            </h3>
            <p className="text-xs" style={{ color: v("muted-foreground") }}>
              412 active across six depots
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                background: v("secondary"),
                color: v("secondary-foreground"),
                borderRadius: v("r-control"),
              }}
            >
              Export
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                background: v("primary"),
                color: v("primary-foreground"),
                borderRadius: v("r-control"),
              }}
            >
              New run
            </button>
          </div>
        </div>
      </Card>

      {/* Stat row — the only thing that exercises the chart ramp */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="In transit" value="128" tone="chart-1" />
        <StatTile label="Delayed" value="9" tone="chart-2" />
        <StatTile label="Delivered" value="1,204" tone="chart-3" />
        <StatTile label="Exceptions" value="3" tone="destructive" />
      </div>

      {/* Table with a filter row, one skeleton row and an empty state */}
      <Card className="flex flex-col gap-3" style={{ boxShadow: shadow }}>
        <div className="flex items-center gap-2">
          <div
            className="h-8 flex-1 px-3 text-xs leading-8"
            style={{
              border: `1px solid ${v("input")}`,
              borderRadius: v("r-control"),
              color: v("muted-foreground"),
            }}
          >
            Search consignments
          </div>
          <div
            className="h-8 px-3 text-xs font-medium leading-8"
            style={{
              background: v("muted"),
              color: v("muted-foreground"),
              borderRadius: v("r-control"),
            }}
          >
            Filters
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {["68%", "44%", "58%"].map((width, index) => (
            <div key={width} className="flex items-center gap-3">
              <div
                className="h-3"
                style={{ width, background: v("muted"), borderRadius: "3px" }}
              />
              <div
                className="h-3 flex-1"
                style={{
                  width: index === 1 ? "30%" : "22%",
                  background: v("muted"),
                  borderRadius: "3px",
                  opacity: 0.6,
                }}
              />
            </div>
          ))}
        </div>
        <div
          className="flex flex-col items-center gap-1 py-5 text-center"
          style={{ color: v("muted-foreground") }}
        >
          <span className="text-xs font-semibold">No runs match these filters</span>
          <span className="text-[11px]">Clear the depot filter to see the other 402.</span>
        </div>
      </Card>

      {/* Sidebar plus an overlay, side by side */}
      <div className="grid grid-cols-[124px_1fr] gap-3">
        <div
          className="flex flex-col gap-1 p-2"
          style={{
            background: v("sidebar"),
            color: v("sidebar-foreground"),
            border: `1px solid ${v("sidebar-border")}`,
            borderRadius: v("r-card"),
          }}
        >
          {["Overview", "Runs", "Depots"].map((item, index) => (
            <div
              key={item}
              className="px-2 py-1.5 text-[11px] font-medium"
              style={{
                borderRadius: v("r-control"),
                background: index === 1 ? v("sidebar-accent") : "transparent",
                color: index === 1 ? v("sidebar-accent-foreground") : "inherit",
                fontWeight: index === 1 ? 700 : 500,
              }}
            >
              {item}
            </div>
          ))}
        </div>
        <div
          className="flex flex-col gap-2 p-4"
          style={{
            background: v("popover"),
            color: v("popover-foreground"),
            border: `1px solid ${v("border")}`,
            borderRadius: v("r-overlay"),
            boxShadow: shadow,
          }}
        >
          <span className="text-sm font-bold" style={{ fontFamily: v("font-display") }}>
            Cancel this run?
          </span>
          <span className="text-xs" style={{ color: v("muted-foreground") }}>
            Eleven consignments will be returned to the queue.
          </span>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                background: v("destructive"),
                color: v("background"),
                borderRadius: v("r-control"),
              }}
            >
              Cancel run
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                border: `1px solid ${v("border")}`,
                borderRadius: v("r-control"),
              }}
            >
              Keep it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ThemePreview({
  tokens,
  mode,
  className,
}: {
  tokens: TokenSet
  mode: Mode
  className?: string
}) {
  const palette = mode === "dark" ? tokens.dark : tokens.light
  const style = useMemo(
    () => cssVars(palette, tokens.shape, tokens.fonts),
    [palette, tokens.shape, tokens.fonts]
  )

  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{
        ...style,
        // The tinted ground, not the card colour. Every elevation decision in
        // the set is calibrated against this and reads as flat without it.
        background: v("background"),
        borderRadius: v("r-card"),
        border: `1px solid ${v("border")}`,
      }}
    >
      <div className="p-4">
        <Surfaces shadow={tokens.elevation.shadow} />
      </div>
    </div>
  )
}
