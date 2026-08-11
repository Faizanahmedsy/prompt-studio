"use client"

import type { CSSProperties, JSX } from "react"

import { cn } from "@/lib/utils"

import type { Wire, WireAlign, WireTone } from "../data/wire"

type ThumbSize = "sm" | "md" | "lg"

/** One scale factor drives every measurement, so all sizes stay in proportion. */
const UNIT: Record<ThumbSize, number> = { sm: 1.6, md: 2.6, lg: 3.6 }

const toneClass: Record<WireTone, string> = {
  line: "wire-line",
  strong: "wire-strong",
  surface: "wire-surface",
  accent: "wire-accent",
  accentSoft: "wire-accent-soft",
  accentLine: "wire-accent-line",
}

const alignClass: Record<WireAlign, string> = {
  start: "justify-start items-start",
  center: "justify-center items-center",
  end: "justify-end items-end",
  between: "justify-between items-center",
}

function renderWire(node: Wire, unit: number, key: number | string): JSX.Element {
  switch (node.k) {
    case "frame": {
      const variant = node.variant ?? "plain"
      if (variant === "browser") {
        return (
          <div key={key} className="flex h-full w-full flex-col overflow-hidden">
            <div
              className="wire-surface flex shrink-0 items-center gap-[3px] border-b wire-border-b"
              style={{ height: unit * 3, paddingInline: unit }}
            >
              {["", "", ""].map((_, i) => (
                <span
                  key={i}
                  className="wire-line inline-block rounded-full"
                  style={{ width: unit, height: unit }}
                />
              ))}
              <span
                className="wire-line ml-1 inline-block rounded-full"
                style={{ height: unit * 1.2, width: "38%" }}
              />
            </div>
            <div className="min-h-0 flex-1" style={{ padding: unit }}>
              {renderWire(node.child, unit, "frame-child")}
            </div>
          </div>
        )
      }
      if (variant === "phone") {
        return (
          <div key={key} className="flex h-full w-full items-center justify-center">
            <div
              className="wire-border flex h-full flex-col overflow-hidden rounded-[10px] border"
              style={{ width: "44%", padding: unit * 0.8 }}
            >
              <div className="mb-1 flex justify-center">
                <span
                  className="wire-line rounded-full"
                  style={{ width: "34%", height: unit }}
                />
              </div>
              <div className="min-h-0 flex-1">
                {renderWire(node.child, unit * 0.85, "phone-child")}
              </div>
            </div>
          </div>
        )
      }
      return (
        <div key={key} className="h-full w-full">
          {renderWire(node.child, unit, "plain-child")}
        </div>
      )
    }

    case "stack": {
      const style: CSSProperties = {
        gap: (node.gap ?? 1) * unit,
        padding: (node.pad ?? 0) * unit,
      }
      if (node.grow) style.flex = `${node.grow} 1 0%`
      if (node.h) style.height = `${node.h}%`
      if (node.w) {
        style.width = `${node.w}%`
        style.flex = "0 0 auto"
      }
      return (
        <div
          key={key}
          style={style}
          className={cn(
            "flex min-h-0 min-w-0",
            node.dir === "row" ? "flex-row" : "flex-col",
            node.tone && toneClass[node.tone],
            node.border && "wire-border border",
            node.rounded && "rounded-[4px]",
            node.align
              ? alignClass[node.align]
              : node.dir === "row"
                ? "items-center"
                : "items-stretch"
          )}
        >
          {node.children.map((child, i) => renderWire(child, unit, i))}
        </div>
      )
    }

    case "bar":
      return (
        <span
          key={key}
          className={cn("block shrink-0 rounded-full", toneClass[node.tone ?? "line"])}
          style={{ width: `${node.w}%`, height: (node.h ?? 1) * unit }}
        />
      )

    case "pill":
      return (
        <span
          key={key}
          className={cn(
            "block shrink-0 rounded-full",
            node.outline
              ? "wire-border-accent border bg-transparent"
              : toneClass[node.tone ?? "accent"]
          )}
          style={{ width: `${node.w}%`, height: unit * 2.2 }}
        />
      )

    case "circle": {
      const scale = node.size === "lg" ? 4 : node.size === "sm" ? 2 : 3
      return (
        <span
          key={key}
          className={cn("block shrink-0 rounded-full", toneClass[node.tone ?? "accentLine"])}
          style={{ width: unit * scale, height: unit * scale }}
        />
      )
    }

    case "grid": {
      const total = node.cols * (node.rows ?? 1)
      const style: CSSProperties = {
        gap: (node.gap ?? 1) * unit,
        gridTemplateColumns: `repeat(${node.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${node.rows ?? 1}, minmax(0, 1fr))`,
      }
      if (node.grow) style.flex = `${node.grow} 1 0%`
      if (node.h) style.height = `${node.h}%`
      return (
        <div key={key} className="grid min-h-0 min-w-0" style={style}>
          {Array.from({ length: total }, (_, i) =>
            renderWire(typeof node.cell === "function" ? node.cell(i) : node.cell, unit, i)
          )}
        </div>
      )
    }

    case "chart": {
      const style: CSSProperties = {}
      if (node.grow) style.flex = `${node.grow} 1 0%`
      if (node.h) style.height = `${node.h}%`
      if (node.variant === "donut") {
        return (
          <div key={key} className="flex min-h-0 items-center justify-center" style={style}>
            <span className="wire-donut block aspect-square h-full rounded-full" />
          </div>
        )
      }
      if (node.variant === "line") {
        return (
          <div key={key} className="min-h-0" style={style}>
            <svg
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              className="h-full w-full"
              aria-hidden="true"
            >
              <polyline
                points="0,32 18,24 34,28 52,12 70,18 86,6 100,10"
                fill="none"
                stroke="var(--thumb-accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )
      }
      const heights = [45, 70, 35, 90, 60, 78]
      return (
        <div
          key={key}
          className="flex min-h-0 items-end"
          style={{ ...style, gap: unit * 0.8 }}
        >
          {heights.map((h, i) => (
            <span
              key={i}
              className={cn(
                "block flex-1 rounded-[2px]",
                i === 3 ? "wire-accent" : "wire-accent-line"
              )}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )
    }

    case "table": {
      const cols = node.cols ?? 4
      const rows = node.rows ?? 4
      const style: CSSProperties = {}
      if (node.grow) style.flex = `${node.grow} 1 0%`
      return (
        <div key={key} className="flex min-h-0 flex-col" style={{ ...style, gap: unit * 0.7 }}>
          {node.header !== false && (
            <div
              className="grid shrink-0"
              style={{
                gap: unit,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: cols }, (_, i) => (
                <span
                  key={i}
                  className="wire-accent-line block rounded-full"
                  style={{ height: unit }}
                />
              ))}
            </div>
          )}
          <div
            className="grid min-h-0 flex-1"
            style={{
              gap: unit,
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: cols * rows }, (_, i) => (
              <span
                key={i}
                className="wire-line block self-center rounded-full"
                style={{ height: unit }}
              />
            ))}
          </div>
        </div>
      )
    }

    case "field":
      return (
        <div
          key={key}
          className="flex shrink-0 flex-col"
          style={{ gap: unit * 0.6, width: `${node.w ?? 100}%` }}
        >
          {node.label !== false && (
            <span
              className="wire-line block rounded-full"
              style={{ width: "34%", height: unit * 0.9 }}
            />
          )}
          <span
            className="wire-border wire-field block rounded-[3px] border"
            style={{ height: unit * 2.4 }}
          />
        </div>
      )

    case "avatarRow":
      return (
        <div
          key={key}
          className="flex shrink-0 items-center"
          style={{ gap: unit, width: `${node.w ?? 100}%` }}
        >
          <span
            className="wire-accent-line block shrink-0 rounded-full"
            style={{ width: unit * 3, height: unit * 3 }}
          />
          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: unit * 0.5 }}>
            <span className="wire-strong block w-[60%] rounded-full" style={{ height: unit }} />
            <span className="wire-line block w-[40%] rounded-full" style={{ height: unit * 0.8 }} />
          </span>
        </div>
      )

    case "spacer":
      return (
        <span
          key={key}
          className="block"
          style={
            node.h
              ? { height: `${node.h}%` }
              : { flex: `${node.grow ?? 1} 1 0%` }
          }
        />
      )

    default:
      return <span key={key} />
  }
}

export type LayoutThumbProps = {
  wire: Wire
  size?: ThumbSize
  /** Project primary colour so previews reflect the design system being built. */
  accent?: string
  radius?: number
  className?: string
  /** Renders the interactive affordances (hover lift, selected ring). */
  interactive?: boolean
  selected?: boolean
}

export function LayoutThumb({
  wire,
  size = "md",
  accent,
  radius,
  className,
  interactive = false,
  selected = false,
}: LayoutThumbProps) {
  const unit = UNIT[size]
  return (
    <div
      aria-hidden="true"
      className={cn(
        "wire-thumb relative aspect-[16/10] w-full overflow-hidden rounded-lg border bg-card",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-[2px] group-hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none",
        selected ? "border-[var(--thumb-accent)] shadow-sm" : "border-border",
        className
      )}
      style={
        {
          "--thumb-accent": accent || "var(--primary)",
          "--thumb-radius": radius != null ? `${radius}px` : undefined,
          padding: unit * 1.4,
        } as CSSProperties
      }
    >
      <div className="h-full w-full">{renderWire(wire, unit, "root")}</div>
    </div>
  )
}
