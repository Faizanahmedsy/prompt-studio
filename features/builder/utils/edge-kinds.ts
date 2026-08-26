import type { EdgeKind } from "@/features/builder/utils/graph"

/** The module-to-module transitions drawn inside an expanded screen. */
export type CanvasEdgeKind = EdgeKind | "module"

export type EdgeKindMeta = {
  label: string
  /** what the colour means, in the legend and the edge's tooltip */
  hint: string
  /** CSS custom property holding the colour, defined in globals.css */
  color: string
  dashed: boolean
}

/**
 * One colour per kind of connection.
 *
 * Every arrow used to be the same grey, so a canvas of ninety screens read as
 * a ball of wool: nothing separated "this is the next step" from "this returns
 * to the list" or "this is one of four ways out of here". The colours are the
 * legend on the canvas, and the same names are used by the outline and the
 * generated prompt, so what you see is what the model is told.
 */
export const edgeKindMeta: Record<CanvasEdgeKind, EdgeKindMeta> = {
  next: {
    label: "Next step",
    hint: "Moves forward to the screen that follows",
    color: "var(--rel-next)",
    dashed: false,
  },
  branch: {
    label: "Branch",
    hint: "One of several ways out of the same screen",
    color: "var(--rel-branch)",
    dashed: false,
  },
  jump: {
    label: "Jump",
    hint: "Skips ahead — a shortcut or a link from a menu",
    color: "var(--rel-jump)",
    dashed: false,
  },
  back: {
    label: "Back / loop",
    hint: "Returns to a screen the user already passed",
    color: "var(--rel-back)",
    dashed: true,
  },
  module: {
    label: "Inside a screen",
    hint: "Moves between two modules of the same screen",
    color: "var(--rel-module)",
    dashed: true,
  },
}

export const canvasEdgeKinds: CanvasEdgeKind[] = [
  "next",
  "branch",
  "jump",
  "back",
  "module",
]

export function edgeKindOf(value: unknown): CanvasEdgeKind {
  return typeof value === "string" && value in edgeKindMeta
    ? (value as CanvasEdgeKind)
    : "next"
}
