"use client"

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
} from "@xyflow/react"
import { Plus, X } from "lucide-react"
import { useState } from "react"

import {
  deleteEdge,
  deleteModuleEdge,
  updateEdge,
  updateModuleEdge,
} from "@/features/builder/utils/actions"
import { edgeKindMeta, edgeKindOf } from "@/features/builder/utils/edge-kinds"
import { lanePath } from "@/features/builder/utils/edge-lanes"
import { cn } from "@/lib/utils"

/**
 * A connection you can actually work with: a generous invisible hit area, a
 * label chip that edits in place, and a delete button. The label is what the
 * generated prompt uses to describe the transition, so it has to be as easy to
 * fix as the screens themselves.
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  selected,
  data,
}: EdgeProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(label ?? ""))
  // Screen transitions and module transitions render identically but live in
  // different arrays, so the edit and delete calls have to be told apart.
  const inner = data?.level === "module"
  const remove = inner ? deleteModuleEdge : deleteEdge
  const rename = inner ? updateModuleEdge : updateEdge

  const kind = inner ? "module" : edgeKindOf(data?.kind)
  const meta = edgeKindMeta[kind]

  /**
   * A right-angled path is the clearest way to draw one step forward, and the
   * worst way to draw anything else: a loop back to an earlier column has to
   * turn around, and smooth-step turns around *through* whatever cards sit in
   * between. Loops and jumps therefore arc instead — the curve leaves the
   * lane the nodes are in, which is why it stops crossing them.
   */
  const curved = kind === "back" || kind === "jump"
  // A lane is only present when the canvas found something in the way — see
  // `laneFor`. Without one, a jump and a loop are drawn as gentle arcs.
  const lane = typeof data?.lane === "number" ? data.lane : null

  const [edgePath, labelX, labelY] = lane !== null
    ? lanePath(sourceX, sourceY, targetX, targetY, lane)
    : curved
    ? getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        curvature: kind === "back" ? 0.65 : 0.4,
      })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 10,
      })

  const commit = () => {
    rename(id, draft.trim())
    setEditing(false)
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        // Wide invisible band so the line is clickable without pixel hunting.
        interactionWidth={28}
        style={{
          // Colour carries the meaning — see `edgeKindMeta` and the canvas
          // legend. Selection only brightens what is already there, so the
          // kind of a connection stays readable while it is being edited.
          stroke: selected ? "var(--primary)" : meta.color,
          strokeWidth: selected ? 2.5 : inner ? 1.3 : 1.7,
          opacity: selected ? 1 : 0.85,
          strokeDasharray: meta.dashed && !selected ? "5 4" : undefined,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className="nodrag nopan group pointer-events-auto absolute flex items-center gap-0.5"
        >
          {editing ? (
            <input
              // The editor is created by the click that opens it and removed on
              // blur, so not focusing it would mean a second click to type.
              // biome-ignore lint/a11y/noAutofocus: see above
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit()
                if (event.key === "Escape") {
                  setDraft(String(label ?? ""))
                  setEditing(false)
                }
              }}
              placeholder="on submit"
              className="w-36 rounded-full border border-primary bg-card px-2 py-0.5 text-[10px] shadow-sm outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(String(label ?? ""))
                setEditing(true)
              }}
              style={
                label && !selected
                  ? {
                      borderColor: meta.color,
                      color: meta.color,
                      // Solid, not translucent: a label sitting over a card has
                      // to stay readable, and this one is a button.
                      background: "var(--card)",
                    }
                  : undefined
              }
              className={cn(
                "group/label max-w-40 truncate rounded-full border bg-card px-2 py-0.5 text-[10px] shadow-sm transition-colors",
                label
                  ? "border-border text-foreground hover:border-primary"
                  : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground",
                selected && "border-primary text-primary"
              )}
              title={`${meta.label} — ${meta.hint}. Click to edit what triggers it.`}
            >
              {label || (
                <span className="flex items-center gap-0.5">
                  <Plus className="size-2.5" /> label
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => remove(id)}
            aria-label="Delete connection"
            title="Delete connection"
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
