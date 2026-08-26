export type Box = { x: number; y: number; width: number; height: number }
export type Point = { x: number; y: number }

/**
 * Orthogonal edge routing that goes **around** the cards.
 *
 * No graph library routes around obstacles: every path it can draw — step,
 * bezier, straight — is computed from two endpoints and knows nothing about
 * what stands between them. On a small diagram that is invisible; on a real one
 * of ninety screens it is a line drawn straight across four cards, which is
 * what made the canvas unreadable.
 *
 * So the canvas routes them itself. The gaps between the cards form a grid of
 * channels — the lines just outside each card's edges — and a path through that
 * grid is a path that never crosses a card. A* over those channels, with a
 * penalty for turning, gives the shortest such path that also looks deliberate
 * rather than jittery.
 */

/** How far clear of a card a line is allowed to run. */
const CLEARANCE = 20
/** How far a line leaves its port before it is allowed to turn. */
const STUB = 22
/** Paying this much per corner buys straight lines wherever one exists. */
const TURN_COST = 60
/** Beyond this the search is not worth its own cost — fall back to a curve. */
const MAX_GRID = 9000

const portsOf = (from: Box, to: Box) => ({
  source: { x: from.x + from.width, y: from.y + from.height / 2 },
  target: { x: to.x, y: to.y + to.height / 2 },
})

function grow(box: Box, by: number): Box {
  return {
    x: box.x - by,
    y: box.y - by,
    width: box.width + by * 2,
    height: box.height + by * 2,
  }
}

/** Strict, so a line may run along a padded border without counting as a hit. */
function segmentHits(a: Point, b: Point, rect: Box) {
  return (
    Math.max(a.x, b.x) > rect.x &&
    Math.min(a.x, b.x) < rect.x + rect.width &&
    Math.max(a.y, b.y) > rect.y &&
    Math.min(a.y, b.y) < rect.y + rect.height
  )
}

function anyHit(a: Point, b: Point, rects: Box[]) {
  for (const rect of rects) if (segmentHits(a, b, rect)) return true
  return false
}

/**
 * Would the library's own path cross anything?
 *
 * Approximated by the step path it would draw — out of the port, across at the
 * midpoint, into the target — which is the shape that actually gets rendered
 * for everything except a loop.
 */
export function pathIsClear(from: Box, to: Box, obstacles: Box[]): boolean {
  const { source, target } = portsOf(from, to)
  const rects = obstacles.map((box) => grow(box, 2))
  const mid = (source.x + target.x) / 2
  const corners: Point[] = [
    source,
    { x: mid, y: source.y },
    { x: mid, y: target.y },
    target,
  ]
  for (let i = 0; i < corners.length - 1; i += 1) {
    if (anyHit(corners[i], corners[i + 1], rects)) return false
  }
  return true
}

/** Coordinates worth turning on, thinned until the grid is small enough. */
function axis(values: number[], low: number, high: number, cap: number) {
  const inside = values
    .filter((value) => value >= low && value <= high)
    .sort((a, b) => a - b)
  let tolerance = 6
  let kept = thin(inside, tolerance)
  while (kept.length > cap && tolerance < 400) {
    tolerance *= 2
    kept = thin(inside, tolerance)
  }
  return kept
}

function thin(sorted: number[], tolerance: number) {
  const out: number[] = []
  for (const value of sorted) {
    if (!out.length || value - out[out.length - 1] > tolerance) out.push(value)
  }
  return out
}

function nearest(values: number[], target: number) {
  let best = 0
  for (let i = 1; i < values.length; i += 1) {
    if (Math.abs(values[i] - target) < Math.abs(values[best] - target)) best = i
  }
  return best
}

/**
 * A path from one card's right port to another's left port that touches no
 * card in between, or `null` when there is no such path worth drawing.
 *
 * `obstacles` must exclude the two ends: a line has to be allowed to leave its
 * own card.
 */
export function routeAround(
  from: Box,
  to: Box,
  obstacles: Box[]
): Point[] | null {
  const { source, target } = portsOf(from, to)
  const start: Point = { x: source.x + STUB, y: source.y }
  const end: Point = { x: target.x - STUB, y: target.y }

  const margin = 260
  const low = { x: Math.min(start.x, end.x) - margin, y: Math.min(start.y, end.y) - margin }
  const high = { x: Math.max(start.x, end.x) + margin, y: Math.max(start.y, end.y) + margin }

  const near = obstacles.filter(
    (box) =>
      box.x + box.width > low.x &&
      box.x < high.x &&
      box.y + box.height > low.y &&
      box.y < high.y
  )
  const rects = near.map((box) => grow(box, CLEARANCE))

  // The channels: just outside every card, plus the two ends themselves.
  const xValues = [start.x, end.x]
  const yValues = [start.y, end.y]
  for (const rect of rects) {
    xValues.push(rect.x, rect.x + rect.width)
    yValues.push(rect.y, rect.y + rect.height)
  }

  const perAxis = Math.floor(Math.sqrt(MAX_GRID))
  const xs = axis(xValues, low.x, high.x, perAxis)
  const ys = axis(yValues, low.y, high.y, perAxis)
  // The two ends have to be on the grid, whatever the thinning did.
  for (const [values, wanted] of [
    [xs, start.x],
    [xs, end.x],
    [ys, start.y],
    [ys, end.y],
  ] as const) {
    if (!values.some((value) => Math.abs(value - wanted) < 0.5)) {
      values.push(wanted)
      values.sort((a, b) => a - b)
    }
  }
  if (xs.length * ys.length > MAX_GRID) return null

  const startI = nearest(xs, start.x)
  const startJ = nearest(ys, start.y)
  const endI = nearest(xs, end.x)
  const endJ = nearest(ys, end.y)

  const at = (i: number, j: number): Point => ({ x: xs[i], y: ys[j] })
  const id = (i: number, j: number) => j * xs.length + i
  const total = xs.length * ys.length

  const cost = new Float64Array(total).fill(Number.POSITIVE_INFINITY)
  const cameFrom = new Int32Array(total).fill(-1)
  // 0 none · 1 horizontal · 2 vertical — a turn is what gets charged for.
  const heading = new Int8Array(total)
  const done = new Uint8Array(total)

  const startId = id(startI, startJ)
  const endId = id(endI, endJ)
  cost[startId] = 0
  heading[startId] = 1

  const guess = (i: number, j: number) =>
    Math.abs(xs[i] - xs[endI]) + Math.abs(ys[j] - ys[endJ])

  // A small binary heap; the grid is capped, so this stays cheap.
  const heap: Array<{ id: number; f: number }> = [{ id: startId, f: guess(startI, startJ) }]
  const push = (entry: { id: number; f: number }) => {
    heap.push(entry)
    let child = heap.length - 1
    while (child > 0) {
      const parent = (child - 1) >> 1
      if (heap[parent].f <= heap[child].f) break
      ;[heap[parent], heap[child]] = [heap[child], heap[parent]]
      child = parent
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length && last) {
      heap[0] = last
      let parent = 0
      for (;;) {
        const left = parent * 2 + 1
        const right = left + 1
        let smallest = parent
        if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left
        if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right
        if (smallest === parent) break
        ;[heap[parent], heap[smallest]] = [heap[smallest], heap[parent]]
        parent = smallest
      }
    }
    return top
  }

  while (heap.length) {
    const current = pop()
    if (!current || done[current.id]) continue
    done[current.id] = 1
    if (current.id === endId) break

    const i = current.id % xs.length
    const j = Math.floor(current.id / xs.length)
    const here = at(i, j)

    const steps: Array<[number, number, 1 | 2]> = [
      [i + 1, j, 1],
      [i - 1, j, 1],
      [i, j + 1, 2],
      [i, j - 1, 2],
    ]
    for (const [ni, nj, direction] of steps) {
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length) continue
      const nextId = id(ni, nj)
      if (done[nextId]) continue
      const there = at(ni, nj)
      if (anyHit(here, there, rects)) continue
      const turn = heading[current.id] !== direction ? TURN_COST : 0
      const next =
        cost[current.id] +
        Math.abs(there.x - here.x) +
        Math.abs(there.y - here.y) +
        turn
      if (next >= cost[nextId]) continue
      cost[nextId] = next
      cameFrom[nextId] = current.id
      heading[nextId] = direction
      push({ id: nextId, f: next + guess(ni, nj) })
    }
  }

  if (!Number.isFinite(cost[endId])) return null

  const path: Point[] = []
  for (let node = endId; node !== -1; node = cameFrom[node]) {
    path.push(at(node % xs.length, Math.floor(node / xs.length)))
    if (node === startId) break
  }
  path.reverse()

  return simplify([source, ...path, target])
}

/** Drop points that sit on the line between their neighbours. */
export function simplify(points: Point[]): Point[] {
  const out: Point[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) {
      continue
    }
    out.push(point)
  }
  for (let i = 1; i < out.length - 1; ) {
    const a = out[i - 1]
    const b = out[i]
    const c = out[i + 1]
    const collinear =
      (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) ||
      (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5)
    if (collinear) out.splice(i, 1)
    else i += 1
  }
  return out
}

/**
 * An SVG path through the points, with rounded corners, plus where the label
 * belongs: the middle of the longest straight run, which is the only part of a
 * routed edge with room for one.
 */
export function pathFromPoints(
  points: Point[],
  radius = 12
): [string, number, number] {
  if (points.length < 2) return ["", 0, 0]

  let path = `M ${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const previous = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y)
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y)
    const r = Math.min(radius, inLength / 2, outLength / 2)
    if (r < 1) {
      path += ` L ${corner.x},${corner.y}`
      continue
    }
    const enter = {
      x: corner.x + ((previous.x - corner.x) / inLength) * r,
      y: corner.y + ((previous.y - corner.y) / inLength) * r,
    }
    const leave = {
      x: corner.x + ((next.x - corner.x) / outLength) * r,
      y: corner.y + ((next.y - corner.y) / outLength) * r,
    }
    path += ` L ${enter.x},${enter.y} Q ${corner.x},${corner.y} ${leave.x},${leave.y}`
  }
  const last = points[points.length - 1]
  path += ` L ${last.x},${last.y}`

  let best = { length: -1, x: last.x, y: last.y }
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length > best.length) {
      best = { length, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  }
  return [path, best.x, best.y]
}

/**
 * Where each connection's label goes, moved apart when two would land on top
 * of each other.
 *
 * Labels are placed by the graph library at the middle of each path, and two
 * connections arriving at the same port have their middles in almost the same
 * place — which is how "click the subscriber" ended up printed over "click the
 * recipient". Knowing every label at once is the only way to separate them, and
 * only the canvas knows that, so it is worked out here and handed to each edge.
 */
export function placeLabels(
  wanted: Array<{ id: string; x: number; y: number; width: number }>,
  { height = 20, step = 22, tries = 6 } = {}
): Map<string, Point> {
  const taken: Array<{ x: number; y: number; width: number }> = []
  const out = new Map<string, Point>()

  const clashes = (x: number, y: number, width: number) =>
    taken.some(
      (box) =>
        Math.abs(box.y - y) < height &&
        Math.abs(box.x - x) < (box.width + width) / 2
    )

  // Stable order, so the same graph always separates the same way.
  for (const label of [...wanted].sort((a, b) => a.id.localeCompare(b.id))) {
    let placed = { x: label.x, y: label.y }
    for (let attempt = 0; attempt <= tries; attempt += 1) {
      // Alternate above and below the line, widening each time.
      const offset =
        attempt === 0
          ? 0
          : (attempt % 2 === 1 ? -1 : 1) * step * Math.ceil(attempt / 2)
      const y = label.y + offset
      if (!clashes(label.x, y, label.width)) {
        placed = { x: label.x, y }
        break
      }
    }
    taken.push({ x: placed.x, y: placed.y, width: label.width })
    out.set(label.id, placed)
  }
  return out
}

/** Roughly how wide a label chip renders, for the collision check above. */
export function labelWidth(text: string) {
  // 5.6px per character at the chip's font size, plus its padding, capped the
  // same way the chip itself is capped.
  return Math.min(text.length * 5.6 + 22, 172)
}

/** Where the library would put a step path's label, without drawing one. */
export function stepLabelPoint(from: Box, to: Box): Point {
  const { source, target } = portsOf(from, to)
  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
}
