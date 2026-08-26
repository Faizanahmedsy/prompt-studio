"use client"

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react"
import { X } from "lucide-react"

import { deleteRelation } from "@/features/data/utils/actions"
import {
  relationKindMeta,
  relationKindOf,
} from "@/features/data/utils/relation-kinds"
import { cn } from "@/lib/utils"

/**
 * A relation between two columns. The chip says which way the cardinality
 * runs — `N:1` reads "many of these, one of those" — and the colour repeats it
 * so the shape of the model is readable without reading any of the chips.
 */
export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const kind = relationKindOf(data?.kind)
  const meta = relationKindMeta[kind]
  const label = typeof data?.label === "string" ? data.label : ""

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={26}
        style={{
          stroke: selected ? "var(--primary)" : meta.color,
          strokeWidth: selected ? 2.4 : 1.6,
          strokeDasharray: meta.dashed && !selected ? "6 4" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className="nodrag nopan group pointer-events-auto absolute flex items-center gap-0.5"
        >
          <span
            title={`${meta.label} — ${meta.hint}`}
            style={
              selected
                ? undefined
                : { borderColor: meta.color, color: meta.color }
            }
            className={cn(
              "rounded-full border bg-card px-1.5 py-0.5 font-mono text-[10px] shadow-sm",
              selected && "border-primary text-primary"
            )}
          >
            {meta.short}
            {label ? ` · ${label}` : ""}
          </span>
          <button
            type="button"
            onClick={() => deleteRelation(id)}
            aria-label="Delete relation"
            title="Delete relation"
            className={cn(
              "flex size-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors",
              "hover:border-destructive hover:bg-destructive hover:text-destructive-foreground",
              selected
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            )}
          >
            <X className="size-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
