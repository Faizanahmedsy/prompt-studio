"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { memo } from "react"

import { Glyph } from "@/components/icons/glyph"
import { describeModuleKind } from "@/features/library/data/module-kinds"
import { cn } from "@/lib/utils"
import type { ScreenModule } from "@/types/project"

export type ModuleNodeData = {
  module: ScreenModule
}

/**
 * A piece of a screen, shown only while its screen is expanded.
 *
 * Deliberately a slim row rather than a second card: it has to read as *inside*
 * the screen above it, and a screen with a dozen modules still has to fit on
 * one canvas without becoming a wall of boxes.
 */
export const ModuleNode = memo(function ModuleNode({
  data,
  selected,
}: NodeProps & { data: ModuleNodeData }) {
  const { module } = data
  const kind = describeModuleKind(module.kind)

  return (
    <div
      className={cn(
        "group flex h-11 w-full items-center gap-2 rounded-lg border bg-card px-2 shadow-xs transition-shadow",
        selected
          ? "border-primary shadow-sm ring-2 ring-primary/25"
          : "border-border hover:border-primary/40"
      )}
    >
      {/*
        Modules are a vertical stack, so the ports are vertical too: with
        left/right ports every inner arrow looped out around the card and read
        as leaving the screen.
      */}
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-2 !border-card !bg-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
      />

      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-surface text-muted-foreground">
        <Glyph name={kind.icon} className="size-3" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium leading-tight">
          {module.name}
        </span>
        <span className="block truncate text-[9px] leading-tight text-muted-foreground">
          {module.trigger.trim() || kind.name}
        </span>
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !border-2 !border-card !bg-primary opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
})
