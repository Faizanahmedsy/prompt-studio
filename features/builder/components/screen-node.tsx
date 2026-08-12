"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { AlertCircle } from "lucide-react"
import { memo } from "react"

import { Glyph } from "@/components/icons/glyph"
import { describeLayout } from "@/features/library/data/layouts"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import { screenTemplateMap } from "@/features/library/data/templates"
import { cn } from "@/lib/utils"
import type { Screen } from "@/types/project"

export type ScreenNodeData = {
  screen: Screen
  accent: string
  isEntry: boolean
}

/**
 * A canvas node. Ports are deliberately large and always visible on hover —
 * connecting screens is the primary action on this surface.
 */
export const ScreenNode = memo(function ScreenNode({
  data,
  selected,
}: NodeProps & { data: ScreenNodeData }) {
  const { screen, accent, isEntry } = data
  const template = screenTemplateMap[screen.template]
  const layout = screen.layout ? describeLayout(screen.layout) : null

  return (
    <div
      className={cn(
        "group w-56 rounded-xl border bg-card shadow-sm transition-shadow",
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
          <LayoutThumb wire={layout.wire} size="sm" accent={accent} />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
            <AlertCircle className="mr-1 size-3" /> No layout
          </div>
        )}
        <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
          {layout?.name ?? "Choose a layout"}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-card !bg-primary opacity-70 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
})
