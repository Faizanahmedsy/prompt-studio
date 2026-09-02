"use client"

/**
 * The live surfaces a theme is judged on.
 *
 * Five screens rather than one, because different decisions only become visible
 * on different pages. Colour and elevation read on a dashboard; the type scale
 * and the display face only really show on a marketing page; the field
 * treatment is invisible anywhere except a form, which is most of what people
 * actually touch. A token no screen renders is a token somebody gets wrong and
 * only discovers in a generated app.
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
import type { Theme } from "@/types/project"

type Mode = "light" | "dark"

export const previewScreens = [
  { id: "app", label: "App" },
  { id: "form", label: "Form" },
  { id: "auth", label: "Sign in" },
  { id: "marketing", label: "Landing" },
  { id: "data", label: "Data" },
] as const

export type PreviewScreen = (typeof previewScreens)[number]["id"]

/** Token names carry no `--` in the preset; the preview scopes them by prefix. */
function cssVars(
  tokens: Record<string, string>,
  shape: { control: number; card: number; overlay: number; pill: boolean },
  fonts: { display: string; body: string; mono: string }
): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(tokens)) style[`--pv-${key}`] = value
  style["--pv-r-control"] = shape.pill ? "9999px" : `${shape.control}px`
  style["--pv-r-field"] = `${shape.control}px`
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

function Action({
  children,
  tone = "primary",
}: {
  children: React.ReactNode
  tone?: "primary" | "secondary" | "outline" | "destructive"
}) {
  const base = {
    borderRadius: v("r-control"),
    border: "1px solid transparent",
  }
  const tones = {
    primary: { background: v("primary"), color: v("primary-foreground") },
    secondary: { background: v("secondary"), color: v("secondary-foreground") },
    outline: { background: "transparent", color: v("foreground"), borderColor: v("border") },
    destructive: { background: v("destructive"), color: v("background") },
  }
  return (
    <button
      type="button"
      className="px-3 py-1.5 text-xs font-semibold"
      style={{ ...base, ...tones[tone] }}
    >
      {children}
    </button>
  )
}

/**
 * One text field, drawn the way the theme says.
 *
 * This is the whole reason the Form screen exists — the six treatments are
 * indistinguishable in a description and obvious side by side. `filled`
 * disagrees with `outlined` about whether a border exists at all, and
 * `floating` and `inset` disagree with both about where the label lives, so
 * each is drawn rather than approximated with a modifier.
 */
function Field({
  label,
  value,
  style,
  hint,
  error,
  focused,
}: {
  label: string
  value?: string
  style: Theme["inputStyle"]
  hint?: string
  error?: string
  focused?: boolean
}) {
  const ring = error ? v("destructive") : focused ? v("ring") : null
  const box: React.CSSProperties = {
    borderRadius: v("r-field"),
    fontSize: 12,
    color: v("foreground"),
    background: "transparent",
    border: "1px solid transparent",
    padding: "8px 10px",
  }

  if (style === "filled") {
    box.background = v("muted")
  } else if (style === "underline") {
    box.borderRadius = "0"
    box.borderBottom = `1px solid ${ring ?? v("border")}`
    box.padding = "6px 2px"
  } else if (style === "borderless") {
    box.padding = "6px 2px"
  } else {
    box.borderColor = ring ?? v("border")
  }
  if (ring && style !== "underline") {
    box.boxShadow = `0 0 0 2px ${ring}`
    if (style !== "borderless") box.borderColor = ring
  }

  const labelStyle: React.CSSProperties = {
    color: error ? v("destructive") : focused ? v("ring") : v("muted-foreground"),
    fontSize: 10,
    fontWeight: 600,
  }

  // The label lives in a different place for two of the six, so the wrapper
  // changes rather than the label being nudged with a margin.
  if (style === "floating" || style === "inset") {
    const risen = style === "inset" || focused || Boolean(value)
    return (
      <div className="flex flex-col gap-1">
        <div style={{ ...box, paddingTop: risen ? 6 : 10, paddingBottom: risen ? 6 : 10 }}>
          <span
            className="block"
            style={risen ? labelStyle : { ...labelStyle, fontSize: 12, fontWeight: 400 }}
          >
            {label}
          </span>
          {risen && (
            <span className="block" style={{ fontSize: 12 }}>
              {value || " "}
            </span>
          )}
        </div>
        {(hint || error) && (
          <span style={{ fontSize: 10, color: error ? v("destructive") : v("muted-foreground") }}>
            {error || hint}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <span style={labelStyle}>{label}</span>
      <div style={box}>{value || <span style={{ color: v("muted-foreground") }}>&nbsp;</span>}</div>
      {(hint || error) && (
        <span style={{ fontSize: 10, color: error ? v("destructive") : v("muted-foreground") }}>
          {error || hint}
        </span>
      )}
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

function AppScreen({ shadow }: { shadow: string }) {
  return (
    <div className="flex flex-col gap-4">
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
            <Action tone="secondary">Export</Action>
            <Action>New run</Action>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="In transit" value="128" tone="chart-1" />
        <StatTile label="Delayed" value="9" tone="chart-2" />
        <StatTile label="Delivered" value="1,204" tone="chart-3" />
        <StatTile label="Exceptions" value="3" tone="destructive" />
      </div>

      <Card className="flex flex-col gap-3" style={{ boxShadow: shadow }}>
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
          className="flex flex-col items-center gap-1 py-4 text-center"
          style={{ color: v("muted-foreground") }}
        >
          <span className="text-xs font-semibold">No runs match these filters</span>
          <span className="text-[11px]">Clear the depot filter to see the other 402.</span>
        </div>
      </Card>

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
              className="px-2 py-1.5 text-[11px]"
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
            <Action tone="destructive">Cancel run</Action>
            <Action tone="outline">Keep it</Action>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormScreen({ shadow, input }: { shadow: string; input: Theme["inputStyle"] }) {
  return (
    <Card className="flex flex-col gap-4" style={{ boxShadow: shadow }}>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold" style={{ fontFamily: v("font-display") }}>
          Depot details
        </h3>
        <p className="text-xs" style={{ color: v("muted-foreground") }}>
          Where consignments are received and sorted.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Depot name" value="Bristol Central" style={input} />
        <Field label="Code" value="BRS-01" style={input} hint="Three letters, then a number." />
        <Field label="Contact email" value="ops@bristol" style={input} error="Needs a domain." />
        <Field label="Capacity" value="" style={input} focused />
      </div>

      <Field
        label="Delivery window"
        value="07:00 — 19:00, Monday to Saturday"
        style={input}
        hint="Drivers are routed inside this window."
      />

      {/* The controls a form is actually made of, beyond text fields. */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2 text-xs">
          <span
            className="inline-flex size-4 items-center justify-center text-[9px] font-bold"
            style={{
              background: v("primary"),
              color: v("primary-foreground"),
              borderRadius: `min(4px, ${v("r-control")})`,
            }}
          >
            ✓
          </span>
          Accepts returns
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span
            className="inline-flex size-4 items-center justify-center rounded-full"
            style={{ border: `1px solid ${v("border")}` }}
          >
            <span className="size-2 rounded-full" style={{ background: v("primary") }} />
          </span>
          Overnight sorting
        </span>
        <span
          className="inline-flex h-5 w-9 items-center rounded-full p-0.5"
          style={{ background: v("primary") }}
        >
          <span className="size-4 rounded-full" style={{ background: v("background") }} />
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Action tone="outline">Cancel</Action>
        <Action>Save depot</Action>
      </div>
    </Card>
  )
}

function AuthScreen({ shadow, input }: { shadow: string; input: Theme["inputStyle"] }) {
  return (
    <div className="flex justify-center py-6">
      <Card className="flex w-75 flex-col gap-4" style={{ boxShadow: shadow }}>
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold" style={{ fontFamily: v("font-display") }}>
            Sign in
          </h3>
          <p className="text-xs" style={{ color: v("muted-foreground") }}>
            Your depots and runs live in your account.
          </p>
        </div>
        <Field label="Email" value="ops@bristol.co.uk" style={input} />
        <Field label="Password" value="••••••••••" style={input} />
        <Action>Sign in</Action>
        <div className="flex items-center gap-2">
          <span className="h-px flex-1" style={{ background: v("border") }} />
          <span className="text-[10px]" style={{ color: v("muted-foreground") }}>
            or
          </span>
          <span className="h-px flex-1" style={{ background: v("border") }} />
        </div>
        <Action tone="outline">Continue with SSO</Action>
        <p className="text-center text-[11px]" style={{ color: v("muted-foreground") }}>
          Forgotten your password?
        </p>
      </Card>
    </div>
  )
}

function MarketingScreen({ shadow }: { shadow: string }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2
          className="text-3xl font-extrabold"
          style={{
            fontFamily: v("font-display"),
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            textWrap: "balance",
          }}
        >
          Every consignment, accounted for.
        </h2>
        <p className="max-w-[46ch] text-sm" style={{ color: v("muted-foreground") }}>
          Six depots, one board. See what moved, what did not, and who is waiting — without
          calling anyone.
        </p>
        <div className="flex gap-2">
          <Action>Start a trial</Action>
          <Action tone="outline">Book a walkthrough</Action>
        </div>
      </div>

      {/* Two tiers, not three identical cards — the row of three is on the
          ban list, and the preview should not model the thing it forbids. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-2" style={{ boxShadow: shadow }}>
          <span className="text-xs font-bold" style={{ color: v("muted-foreground") }}>
            Single depot
          </span>
          <span
            className="text-2xl font-extrabold"
            style={{ fontFamily: v("font-display"), fontVariantNumeric: "tabular-nums" }}
          >
            £49
          </span>
          <p className="text-[11px]" style={{ color: v("muted-foreground") }}>
            Up to 500 consignments a month.
          </p>
          <Action tone="outline">Choose</Action>
        </Card>
        <Card
          className="flex flex-col gap-2"
          style={{ boxShadow: shadow, borderColor: v("primary") }}
        >
          <span className="text-xs font-bold" style={{ color: v("primary") }}>
            Network
          </span>
          <span
            className="text-2xl font-extrabold"
            style={{ fontFamily: v("font-display"), fontVariantNumeric: "tabular-nums" }}
          >
            £180
          </span>
          <p className="text-[11px]" style={{ color: v("muted-foreground") }}>
            Unlimited depots, driver routing, exports.
          </p>
          <Action>Choose</Action>
        </Card>
      </div>
    </div>
  )
}

function DataScreen({ shadow }: { shadow: string }) {
  const bars = [58, 72, 44, 90, 66, 81, 38]
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3" style={{ boxShadow: shadow }}>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold" style={{ fontFamily: v("font-display") }}>
            Throughput
          </span>
          <span
            className="text-[11px]"
            style={{ color: v("muted-foreground"), fontFamily: v("font-mono") }}
          >
            last 7 days
          </span>
        </div>
        <div className="flex h-24 items-end gap-1.5">
          {bars.map((height, index) => (
            <div
              key={height}
              className="flex-1"
              style={{
                height: `${height}%`,
                background: index === 3 ? v("chart-1") : v("chart-2"),
                opacity: index === 3 ? 1 : 0.55,
                borderRadius: `min(4px, ${v("r-control")})`,
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px]">
              <span className="size-2.5 rounded-full" style={{ background: v(key) }} />
              <span style={{ color: v("muted-foreground"), fontFamily: v("font-mono") }}>
                {key}
              </span>
            </span>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-0 p-0" style={{ boxShadow: shadow }}>
        <div
          className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[10px] font-bold uppercase"
          style={{
            letterSpacing: "0.08em",
            color: v("muted-foreground"),
            borderBottom: `1px solid ${v("border")}`,
          }}
        >
          <span>Depot</span>
          <span>Runs</span>
          <span>Status</span>
        </div>
        {[
          ["Bristol Central", "128", "On time", "chart-3"],
          ["Leeds North", "96", "Delayed", "chart-2"],
          ["Cardiff Bay", "74", "On time", "chart-3"],
          ["Glasgow East", "12", "Halted", "destructive"],
        ].map(([depot, runs, status, tone]) => (
          <div
            key={depot}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2 text-xs"
            style={{ borderBottom: `1px solid ${v("border")}` }}
          >
            <span>{depot}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: v("font-mono") }}>
              {runs}
            </span>
            <span
              className="px-2 py-0.5 text-[10px] font-bold"
              style={{
                borderRadius: v("r-control"),
                border: `1px solid ${v(tone)}`,
                color: v(tone),
              }}
            >
              {status}
            </span>
          </div>
        ))}
      </Card>
    </div>
  )
}

export function ThemePreview({
  tokens,
  mode,
  screen = "app",
  className,
}: {
  tokens: TokenSet
  mode: Mode
  screen?: PreviewScreen
  className?: string
}) {
  const palette = mode === "dark" ? tokens.dark : tokens.light
  const style = useMemo(
    () => cssVars(palette, tokens.shape, tokens.fonts),
    [palette, tokens.shape, tokens.fonts]
  )
  const shadow = tokens.elevation.shadow

  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{
        ...style,
        // The tinted ground, not the card colour. Every elevation decision in
        // the set is calibrated against this and reads as flat without it.
        background: v("background"),
        color: v("foreground"),
        borderRadius: v("r-card"),
        border: `1px solid ${v("border")}`,
        fontFamily: v("font-body"),
      }}
    >
      <div className="p-4">
        {screen === "form" ? (
          <FormScreen shadow={shadow} input={tokens.inputStyle} />
        ) : screen === "auth" ? (
          <AuthScreen shadow={shadow} input={tokens.inputStyle} />
        ) : screen === "marketing" ? (
          <MarketingScreen shadow={shadow} />
        ) : screen === "data" ? (
          <DataScreen shadow={shadow} />
        ) : (
          <AppScreen shadow={shadow} />
        )}
      </div>
    </div>
  )
}
