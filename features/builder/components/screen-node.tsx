"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Plus,
} from "lucide-react"
import { memo, useEffect, useRef } from "react"

import { Glyph } from "@/components/icons/glyph"
import { addModule } from "@/features/builder/utils/actions"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import { describeLayout } from "@/features/library/data/layouts"
import { screenTemplateMap } from "@/features/library/data/templates"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Screen } from "@/types/project"

export type ScreenNodeData = {
  screen: Screen
  accent: string
  isEntry: boolean
  moduleCount: number
  expanded: boolean
}

/**
 * A canvas node. Ports are deliberately large and always visible on hover —
 * connecting screens is the primary action on this surface.
 *
 * When expanded the card is unchanged and a well grows beneath it. The module
 * rows are separate child nodes drawn over that well, positioned from the
 * card's **measured** height, which this component reports.
 */
export const ScreenNode = memo(function ScreenNode({
  data,
  selected,
}: NodeProps & { data: ScreenNodeData }) {
  const { screen, accent, isEntry, moduleCount, expanded } = data
  const template = screenTemplateMap[screen.template]
  const layout = screen.layout ? describeLayout(screen.layout) : null
  // A mobile build should look like one at a glance, before reading a word.
  const phone = screen.surface === "mobile"
  const toggle = useUiStore((s) => s.toggleScreenExpanded)
  const reportCardHeight = useUiStore((s) => s.reportCardHeight)
  const cardRef = useRef<HTMLDivElement>(null)

  // The card's height depends on its thumbnail and text, so it is observed
  // rather than assumed — the canvas needs the real number to place the module
  // rows below it instead of on top of it.
  useEffect(() => {
    const element = cardRef.current
    if (!element) return
    // `offsetHeight` and `borderBoxSize` are layout values — unaffected by the
    // canvas zoom transform, and inclusive of the card's border. `contentRect`
    // would drop the border and leave the rows 2px high on the card.
    reportCardHeight(screen.id, element.offsetHeight)
    const observer = new ResizeObserver(([entry]) => {
      reportCardHeight(
        screen.id,
        entry.borderBoxSize?.[0]?.blockSize ?? element.offsetHeight
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [screen.id, reportCardHeight])

  return (
    <div className="group flex h-full w-full flex-col">
      <div
        ref={cardRef}
        className={cn(
          "relative z-10 shrink-0 rounded-xl border bg-card shadow-sm transition-shadow",
          expanded && "rounded-b-none",
          selected
            ? "border-primary shadow-md ring-2 ring-primary/25"
            : "border-border hover:shadow-md"
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!size-3 !border-2 !border-card !bg-muted-foreground opacity-70 transition-opacity group-hover:opacity-100"
        />

        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Glyph name={template?.icon ?? "file"} className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold leading-tight">
              {screen.title}
            </span>
            <span className="block truncate font-mono text-[10px] text-muted-foreground">
              {screen.key}
            </span>
          </span>
          {isEntry && (
            <span className="shrink-0 rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-success">
              Start
            </span>
          )}
        </div>

        <div className="p-2">
          {layout ? (
            <LayoutThumb
              wire={layout.wire}
              size="sm"
              accent={accent}
              shape={phone ? "phone" : "wide"}
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center border border-dashed border-border text-[10px] text-muted-foreground",
                phone ? "aspect-[9/16] rounded-[12px]" : "aspect-[16/10] rounded-lg"
              )}
            >
              <AlertCircle className="mr-1 size-3" /> No layout
            </div>
          )}

          {/*
            A screen with no modules keeps exactly the footer it always had —
            just the layout name. The toggle only earns space once there is
            something behind it, so a project that ignores modules looks
            untouched.
          */}
          {moduleCount ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                toggle(screen.id)
              }}
              title={`${expanded ? "Hide" : "Show"} what is inside this screen`}
              className="nodrag mt-1.5 flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-[10px] transition-colors hover:bg-muted"
            >
              {expanded ? (
                <ChevronDown className="size-3 shrink-0 text-primary" />
              ) : (
                <ChevronRight className="size-3 shrink-0 text-primary" />
              )}
              <span className="truncate font-medium">
                {moduleCount} module{moduleCount === 1 ? "" : "s"}
              </span>
              <span className="ml-auto truncate text-muted-foreground">
                {expanded ? "Hide" : (layout?.name ?? "Choose a layout")}
              </span>
            </button>
          ) : (
            <p className="mt-1.5 truncate px-1 text-[10px] text-muted-foreground">
              {layout?.name ?? "Choose a layout"}
            </p>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!size-3 !border-2 !border-card !bg-primary opacity-70 transition-opacity group-hover:opacity-100"
        />
      </div>

      {expanded && (
        <div
          className={cn(
            // Opaque, not translucent: the well sits over whatever the canvas
            // has behind it, and a screen showing through read as a bug.
            "min-h-0 flex-1 rounded-b-xl border border-t-0 bg-surface px-2 pb-1.5 pt-1.5 shadow-sm",
            selected ? "border-primary" : "border-border"
          )}
        >
          {/* The module rows are child nodes drawn over this well; only the
              footer actions belong to the screen. */}
          <div className="flex h-full flex-col justify-end">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  addModule(screen.id)
                }}
                className="nodrag flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-3" /> Add module
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  toggle(screen.id)
                }}
                title="Hide what is inside this screen"
                className="nodrag flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronsDownUp className="size-3" /> Collapse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
