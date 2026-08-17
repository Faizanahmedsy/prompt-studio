import type { FlowEdge, Screen } from "@/types/project"

export type GraphAnalysis = {
  /** screens with no incoming edge — where the user starts */
  entries: Screen[]
  /** flow order: breadth-first from every entry, then anything left over */
  ordered: Screen[]
  /** screens no edge points at and that are not entries of a used graph */
  unreachable: Screen[]
  /** screens with more than one outgoing edge */
  branching: Screen[]
  /** screen ids that take part in a cycle */
  cycles: string[][]
  /** edges pointing at a screen that no longer exists */
  danglingEdges: FlowEdge[]
}

export function analyseGraph(
  screens: Screen[],
  edges: FlowEdge[]
): GraphAnalysis {
  const byId = new Map(screens.map((s) => [s.id, s]))
  const danglingEdges = edges.filter((e) => !byId.has(e.from) || !byId.has(e.to))
  const live = edges.filter((e) => byId.has(e.from) && byId.has(e.to))

  const outgoing = new Map<string, FlowEdge[]>()
  const incoming = new Map<string, FlowEdge[]>()
  for (const screen of screens) {
    outgoing.set(screen.id, [])
    incoming.set(screen.id, [])
  }
  for (const edge of live) {
    outgoing.get(edge.from)?.push(edge)
    incoming.get(edge.to)?.push(edge)
  }

  const entries = screens.filter((s) => (incoming.get(s.id) ?? []).length === 0)

  // Breadth-first from each entry keeps the natural "first screen first" read.
  const seen = new Set<string>()
  const ordered: Screen[] = []
  const queue: string[] = entries.map((s) => s.id)
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const screen = byId.get(id)
    if (screen) ordered.push(screen)
    for (const edge of outgoing.get(id) ?? []) {
      if (!seen.has(edge.to)) queue.push(edge.to)
    }
  }
  // Anything only reachable inside a cycle, or fully disconnected.
  for (const screen of screens) {
    if (!seen.has(screen.id)) ordered.push(screen)
  }

  const unreachable =
    live.length === 0
      ? []
      : screens.filter(
          (s) =>
            (incoming.get(s.id) ?? []).length === 0 &&
            (outgoing.get(s.id) ?? []).length === 0
        )

  const branching = screens.filter((s) => (outgoing.get(s.id) ?? []).length > 1)

  return {
    entries,
    ordered,
    unreachable,
    branching,
    cycles: findCycles(screens, outgoing),
    danglingEdges,
  }
}

function findCycles(
  screens: Screen[],
  outgoing: Map<string, FlowEdge[]>
): string[][] {
  const cycles: string[][] = []
  const state = new Map<string, "visiting" | "done">()
  const stack: string[] = []

  const walk = (id: string) => {
    const current = state.get(id)
    if (current === "done") return
    if (current === "visiting") {
      const start = stack.indexOf(id)
      if (start !== -1) cycles.push(stack.slice(start))
      return
    }
    state.set(id, "visiting")
    stack.push(id)
    for (const edge of outgoing.get(id) ?? []) walk(edge.to)
    stack.pop()
    state.set(id, "done")
  }

  for (const screen of screens) walk(screen.id)
  return cycles
}

export function outgoingEdges(edges: FlowEdge[], screenId: string) {
  return edges.filter((e) => e.from === screenId)
}

export function edgeExists(edges: FlowEdge[], from: string, to: string) {
  return edges.some((e) => e.from === from && e.to === to)
}

/**
 * Layered auto-arrange: entries in the first column, each screen one column
 * right of its deepest predecessor. Small graphs only — no dagre needed.
 */
export function autoLayout(
  screens: Screen[],
  edges: FlowEdge[],
  opts: {
    colWidth?: number
    rowHeight?: number
    rowGap?: number
    /**
     * Rendered height per screen. Screens showing their modules are several
     * times taller than collapsed ones, and stacking every row at a fixed
     * pitch drops them straight through the screen below.
     */
    heights?: Map<string, number> | Record<string, number>
  } = {}
): Screen[] {
  // Wide enough that an edge label fits in the gap between two columns.
  const colWidth = opts.colWidth ?? 360
  const rowHeight = opts.rowHeight ?? 210
  const rowGap = opts.rowGap ?? 42
  const heightOf = (id: string) => {
    const map = opts.heights
    const value =
      map instanceof Map ? map.get(id) : map ? (map[id] as number | undefined) : undefined
    // Default keeps the historical pitch for a collapsed graph.
    return value && value > 0 ? value : rowHeight - rowGap
  }
  const { entries } = analyseGraph(screens, edges)
  const depth = new Map<string, number>()
  const start = entries.length ? entries : screens.slice(0, 1)

  // Breadth-first, first visit wins. Deliberately shortest-path rather than
  // longest-path: a cycle (save → list → edit → save) would otherwise keep
  // relaxing depths upward and fling screens thousands of pixels to the right.
  const queue: Array<{ id: string; d: number }> = start.map((s) => ({
    id: s.id,
    d: 0,
  }))
  while (queue.length) {
    const { id, d } = queue.shift()!
    if (depth.has(id)) continue
    depth.set(id, d)
    for (const edge of edges) {
      if (edge.from === id && !depth.has(edge.to)) {
        queue.push({ id: edge.to, d: d + 1 })
      }
    }
  }

  // Each column keeps its own running offset, so a tall expanded screen pushes
  // the rest of its column down instead of overlapping it.
  const nextY = new Map<number, number>()
  return screens.map((screen) => {
    const column = depth.get(screen.id) ?? 0
    const y = nextY.get(column) ?? 0
    nextY.set(column, y + heightOf(screen.id) + rowGap)
    return { ...screen, x: column * colWidth, y }
  })
}
