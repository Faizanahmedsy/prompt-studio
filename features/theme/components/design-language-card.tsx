"use client"

import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

import type { DesignLanguage } from "../data/design-languages"

const shadows: Record<DesignLanguage["preview"]["shadow"], string> = {
  none: "none",
  sm: "0 1px 2px rgb(0 0 0 / 0.06)",
  md: "0 6px 16px -4px rgb(0 0 0 / 0.14)",
  lg: "0 14px 40px -10px var(--dl-accent-glow)",
}

const families: Record<DesignLanguage["preview"]["fontFamily"], string> = {
  sans: "var(--font-sans)",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "var(--font-mono)",
}

/**
 * A live mock of a screen built in this design language — the same handful of
 * elements (header, card, button, input, chip, rows) rendered with the
 * language's own radius, borders, shadow, type and rhythm. Two cards side by
 * side should read as two different products.
 */
export function DesignLanguageCard({
  language,
  accent,
  selected,
  onSelect,
}: {
  language: DesignLanguage
  accent: string
  selected: boolean
  onSelect: () => void
}) {
  const p = language.preview
  const gap = 6 * p.density
  const buttonRadius =
    p.buttonRadius === "full" ? 999 : p.buttonRadius === "md" ? p.radius : 4

  const style = {
    "--dl-accent": accent,
    "--dl-accent-glow": `color-mix(in oklab, ${accent} 45%, transparent)`,
  } as CSSProperties

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={style}
      className={cn(
        "group w-full rounded-xl border p-2 text-left transition-all",
        selected
          ? "border-primary bg-primary-soft/40 shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
      )}
    >
      {/* the mock ------------------------------------------------------- */}
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: p.radius,
          border: p.border ? `${p.border}px solid color-mix(in oklab, var(--foreground) 22%, transparent)` : "none",
          boxShadow: shadows[p.shadow],
          background: p.gradient
            ? `linear-gradient(140deg, color-mix(in oklab, var(--dl-accent) 18%, var(--card)), var(--card) 65%)`
            : "var(--card)",
          padding: gap,
          fontFamily: families[p.fontFamily],
          backdropFilter: p.blur ? "blur(6px)" : undefined,
        }}
      >
        {/* header row */}
        <div className="flex items-center" style={{ gap, marginBottom: gap }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: p.buttonRadius === "full" ? 999 : Math.max(2, p.radius / 2),
              background: "var(--dl-accent)",
            }}
          />
          <span
            style={{
              height: 5,
              width: "34%",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--foreground) 45%, transparent)",
            }}
          />
          <span className="ml-auto flex" style={{ gap: gap / 2 }}>
            <span
              style={{
                height: 5,
                width: 16,
                borderRadius: 999,
                background: "color-mix(in oklab, var(--foreground) 18%, transparent)",
              }}
            />
            <span
              style={{
                height: 5,
                width: 16,
                borderRadius: 999,
                background: "color-mix(in oklab, var(--foreground) 18%, transparent)",
              }}
            />
          </span>
        </div>

        {/* heading + body */}
        <div
          style={{
            fontWeight: p.headingWeight,
            letterSpacing: p.headingTracking,
            textTransform: p.uppercase ? "uppercase" : undefined,
            fontSize: 11,
            marginBottom: gap / 2,
          }}
        >
          Dashboard
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: gap / 2 }}>
          <span
            style={{
              height: 4,
              width: "88%",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--foreground) 14%, transparent)",
            }}
          />
          <span
            style={{
              height: 4,
              width: "62%",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--foreground) 14%, transparent)",
            }}
          />
        </div>

        {/* inner card + chip */}
        <div
          style={{
            marginTop: gap,
            padding: gap,
            borderRadius: Math.max(2, p.radius - 2),
            border: p.border
              ? `${p.border}px solid color-mix(in oklab, var(--foreground) 18%, transparent)`
              : "none",
            background: `color-mix(in oklab, var(--dl-accent) ${p.tint * 100}%, var(--card))`,
            boxShadow: p.shadow === "md" ? shadows.sm : "none",
            display: "flex",
            alignItems: "center",
            gap,
          }}
        >
          <span
            style={{
              height: 4,
              width: "40%",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--foreground) 30%, transparent)",
            }}
          />
          <span
            style={{
              marginLeft: "auto",
              padding: `2px ${gap}px`,
              fontSize: 7,
              lineHeight: 1.4,
              borderRadius: buttonRadius,
              background:
                p.accent === "outline"
                  ? "transparent"
                  : p.accent === "soft"
                    ? "color-mix(in oklab, var(--dl-accent) 25%, transparent)"
                    : "var(--dl-accent)",
              border:
                p.accent === "outline"
                  ? `1px solid color-mix(in oklab, var(--dl-accent) 60%, transparent)`
                  : "none",
              color:
                p.accent === "solid"
                  ? "var(--card)"
                  : "color-mix(in oklab, var(--dl-accent) 90%, var(--foreground))",
              fontWeight: 600,
              textTransform: p.uppercase ? "uppercase" : undefined,
            }}
          >
            Action
          </span>
        </div>

        {/* input */}
        <div
          style={{
            marginTop: gap,
            height: 12,
            borderRadius: p.buttonRadius === "full" ? 999 : Math.max(2, p.radius - 3),
            border: `1px solid color-mix(in oklab, var(--foreground) ${p.border ? 22 : 12}%, transparent)`,
            background: "color-mix(in oklab, var(--foreground) 3%, transparent)",
          }}
        />
      </div>

      {/* label ---------------------------------------------------------- */}
      <div className="px-0.5 pt-2">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-semibold">{language.name}</span>
          {selected && (
            <span className="shrink-0 text-[10px] font-medium text-primary">
              Selected
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {language.tagline}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {language.traits.map((trait) => (
            <span
              key={trait}
              className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
            >
              {trait}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
