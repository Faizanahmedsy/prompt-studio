"use client"

import { ChevronDown, Info } from "lucide-react"
import { useState } from "react"

import {
  type CanvasEdgeKind,
  canvasEdgeKinds,
  edgeKindMeta,
} from "@/features/builder/utils/edge-kinds"
import { cn } from "@/lib/utils"

/**
 * What the colours on the canvas mean.
 *
 * Colour-coding connections is only an improvement if the code is written down
 * somewhere — otherwise it is four arbitrary colours. It starts collapsed to a
 * single chip so it never competes with the graph, and it only lists the kinds
 * this project actually contains.
 */
export function CanvasLegend({
  counts,
}: {
  counts: Partial<Record<CanvasEdgeKind, number>>
}) {
  const [open, setOpen] = useState(false)
  const present = canvasEdgeKinds.filter((kind) => (counts[kind] ?? 0) > 0)
  if (!present.length) return null

  return (
    <div className="absolute bottom-3 left-14 z-10">
      {open ? (
        <div className="rounded-lg border border-border bg-card/95 p-2 shadow-md backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mb-1.5 flex w-full items-center justify-between gap-6 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            Connections
            <ChevronDown className="size-3" />
          </button>
          <ul className="space-y-1">
            {present.map((kind) => {
              const meta = edgeKindMeta[kind]
              return (
                <li
                  key={kind}
                  className="flex items-center gap-2 text-[11px]"
                  title={meta.hint}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-0 w-6 shrink-0 rounded-full border-t-2",
                      meta.dashed ? "border-dashed" : "border-solid"
                    )}
                    style={{ borderColor: meta.color }}
                  />
                  <span className="flex-1 whitespace-nowrap">{meta.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {counts[kind]}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="What do the colours mean?"
          className="flex items-center gap-1 rounded-lg border border-border bg-card/95 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
        >
          <Info className="size-3" />
          Legend
          <span className="ml-0.5 flex items-center gap-0.5" aria-hidden>
            {present.map((kind) => (
              <span
                key={kind}
                className="size-1.5 rounded-full"
                style={{ background: edgeKindMeta[kind].color }}
              />
            ))}
          </span>
        </button>
      )}
    </div>
  )
}
