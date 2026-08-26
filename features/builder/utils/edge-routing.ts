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



/** The polyline the library draws for a plain step edge, for collision maths. */
export function stepPolyline(from: Box, to: Box): Point[] {
  const { source, target } = portsOf(from, to)
  const mid = (source.x + target.x) / 2
  return simplify([
    source,
    { x: mid, y: source.y },
    { x: mid, y: target.y },
    target,
  ])
}

export type LabelRequest = { id: string; points: Point[]; width: number }

/**
 * Put each label somewhere on its own line where nothing else already is.
 *
 * A midpoint is where a label belongs right up until the midpoint is where
 * another line crosses, or where the card behind it starts — and on a real
 * diagram that is most of them. So each label walks its own path outward from
 * the middle looking for a clear spot, and only settles for the middle when
 * there is none.
 *
 * Everything is checked against everything: the cards, every other connection's
 * path, and the labels already placed.
 */
export type LabelPlacement = {
  /** where the chip goes */
  point: Point
  /** the spot on its own line the chip belongs to, for the leader */
  anchor: Point
}

export function placeLabelsOnPaths(
  requests: LabelRequest[],
  nodes: Box[],
  { height = 20 } = {}
): Map<string, LabelPlacement> {
  const out = new Map<string, LabelPlacement>()
  const cards = nodes.map((box) => grow(box, 3))
  // Outward from the middle, then a little off the line either side.
  const fractions = [
    0.5, 0.44, 0.56, 0.38, 0.62, 0.3, 0.7, 0.22, 0.78, 0.14, 0.86,
  ]
  // Deliberately short. A label belongs *on* its connection: chased far enough
  // to find empty space it stops reading as that connection's label at all,
  // which is worse than the crowding it was running from. It moves enough to
  // clear a card or another label, and no further.
  const offsets = [0, -18, 18, -34, 34, -52, 52]
  const sideways = [0, -44, 44]
  // Only used when the tight ones all land on a card or another label — better
  // a chip that moved further, with a leader saying where it belongs, than one
  // printed over a screen's own name.
  const wideOffsets = [-70, 70, -92, 92, -118, 118, -146, 146]
  const wideSideways = [0, -66, 66, -110, 110]

  /**
   * Segments and cards, bucketed by position.
   *
   * Checking every candidate against every segment is quadratic in the size of
   * the diagram, and on a screen where eight journeys converge it ran out of
   * time and fell back to the plain midpoint — which is exactly where the eight
   * lines leaving that screen all are. Looking only at what is nearby makes the
   * search cheap enough to always finish.
   */
  const index = new SegmentIndex()
  for (const request of requests) {
    for (let i = 0; i < request.points.length - 1; i += 1) {
      index.add(request.id, request.points[i], request.points[i + 1])
    }
  }

  const placed: Box[] = []

  // Stable order so the same diagram always resolves the same way.
  for (const request of [...requests].sort((a, b) => a.id.localeCompare(b.id))) {
    const middle = pointAt(request.points, 0.5)
    if (!middle) continue

    // Every candidate is scored rather than accepted or rejected, so a label
    // with nowhere clean to go still lands on the least crowded spot instead
    // of falling back to the middle — which, at a hub, is the one place every
    // other line passes through.
    type Candidate = { point: Point; anchor: Point; score: number }
    // Held in an object rather than a `let`: the search below writes it from
    // inside a closure, which the compiler cannot follow.
    const found: { best: Candidate | null } = { best: null }
    const attempt = (verticals: number[], horizontals: number[]) => {
      search: for (const fraction of fractions) {
        const base = pointAt(request.points, fraction)
        if (!base) continue
        for (const offset of verticals) {
          for (const shift of horizontals) {
            const candidate = { x: base.x + shift, y: base.y + offset }
            const rect: Box = {
              x: candidate.x - request.width / 2,
              y: candidate.y - height / 2,
              width: request.width,
              height,
            }
            // A label over a card, or over another label, is never acceptable —
            // those are the two that read as broken.
            if (hitsAny(rect, cards)) continue
            if (hitsAny(rect, placed)) continue
            // A line passing behind a label is not a defect: the chip is
            // opaque and drawn above the connections, so the line simply
            // disappears under it. It breaks ties, nothing more. What actually
            // has to be avoided — a label over a card, or over another label —
            // is rejected outright above.
            const score =
              index.crossings(rect, request.id) * 0.12 +
              Math.abs(offset) / 60 +
              Math.abs(shift) / 60
            if (score < 0.001) {
              found.best = { point: candidate, anchor: base, score: 0 }
              break search
            }
            if (!found.best || score < found.best.score) {
              found.best = { point: candidate, anchor: base, score }
            }
          }
        }
      }
    }

    attempt(offsets, sideways)
    if (!found.best) attempt(wideOffsets, wideSideways)

    const point = found.best?.point ?? middle
    const rect: Box = {
      x: point.x - request.width / 2,
      y: point.y - height / 2,
      width: request.width,
      height,
    }
    placed.push(rect)
    out.set(request.id, { point, anchor: found.best?.anchor ?? middle })
  }
  return out
}

/** Segments bucketed into fixed cells, so a lookup only sees what is near. */
class SegmentIndex {
  private readonly cell = 180
  private readonly buckets = new Map<string, Array<{ id: string; a: Point; b: Point }>>()

  add(id: string, a: Point, b: Point) {
    const entry = { id, a, b }
    const minX = Math.floor(Math.min(a.x, b.x) / this.cell)
    const maxX = Math.floor(Math.max(a.x, b.x) / this.cell)
    const minY = Math.floor(Math.min(a.y, b.y) / this.cell)
    const maxY = Math.floor(Math.max(a.y, b.y) / this.cell)
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = `${x},${y}`
        const list = this.buckets.get(key)
        if (list) list.push(entry)
        else this.buckets.set(key, [entry])
      }
    }
  }

  /** How many things other than `ignore` pass through this rectangle. */
  crossings(rect: Box, ignore: string) {
    const minX = Math.floor(rect.x / this.cell)
    const maxX = Math.floor((rect.x + rect.width) / this.cell)
    const minY = Math.floor(rect.y / this.cell)
    const maxY = Math.floor((rect.y + rect.height) / this.cell)
    const seen = new Set<string>()
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (const entry of this.buckets.get(`${x},${y}`) ?? []) {
          if (entry.id === ignore || seen.has(entry.id)) continue
          if (segmentCrossesRect(entry.a, entry.b, rect)) seen.add(entry.id)
        }
      }
    }
    return seen.size
  }
}

/** Roughly how wide a label chip renders. */
export function labelWidth(text: string) {
  // Measured against the rendered chip: text, its padding, and the delete
  // button that sits beside it. Guessing low is what let two chips be placed
  // where only one fits.
  return Math.min(text.length * 6.2 + 34, 190)
}

function hitsAny(rect: Box, boxes: Box[]) {
  for (const box of boxes) {
    if (
      rect.x < box.x + box.width &&
      box.x < rect.x + rect.width &&
      rect.y < box.y + box.height &&
      box.y < rect.y + rect.height
    ) {
      return true
    }
  }
  return false
}

function segmentCrossesRect(a: Point, b: Point, rect: Box) {
  // Both ends are axis-aligned in every path this canvas draws, so the
  // segment's own bounding box is the segment.
  return (
    Math.max(a.x, b.x) > rect.x &&
    Math.min(a.x, b.x) < rect.x + rect.width &&
    Math.max(a.y, b.y) > rect.y &&
    Math.min(a.y, b.y) < rect.y + rect.height
  )
}

/** The point a given fraction along a polyline. */
function pointAt(points: Point[], fraction: number): Point | null {
  if (points.length < 2) return points[0] ?? null
  let total = 0
  const lengths: number[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = Math.hypot(
      points[i + 1].x - points[i].x,
      points[i + 1].y - points[i].y
    )
    lengths.push(length)
    total += length
  }
  if (total === 0) return points[0]
  let target = total * fraction
  for (let i = 0; i < lengths.length; i += 1) {
    if (target > lengths[i]) {
      target -= lengths[i]
      continue
    }
    const ratio = lengths[i] === 0 ? 0 : target / lengths[i]
    return {
      x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
      y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
    }
  }
  return points[points.length - 1]
}
