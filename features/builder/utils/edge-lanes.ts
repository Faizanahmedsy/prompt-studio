import type { EdgeKind } from "@/features/builder/utils/graph"

export type NodeBox = { x: number; y: number; width: number; height: number }

/**
 * Where a long connection should travel so it does not cross the cards in
 * between.
 *
 * A step or bezier path between two nodes on the same row is a straight
 * horizontal line, and anything standing on that row is drawn straight through
 * — which is exactly what "catalogue → checkout, skipping two screens" looked
 * like. Nothing in the graph library routes around obstacles, so the canvas
 * works out a clear lane above or below the cards in the way and the edge is
 * drawn through it.
 *
 * Returns `null` when the direct path is already clear, which is the common
 * case and keeps a one-column step looking like a step.
 */
export function laneFor(
  from: NodeBox,
  to: NodeBox,
  others: NodeBox[],
  /** how far clear of a card the lane sits */
  clearance = 28
): number | null {
  const sourceY = from.y + from.height / 2
  const targetY = to.y + to.height / 2

  // The corridor the edge would travel through, between the two ports.
  const left = Math.min(from.x + from.width, to.x)
  const right = Math.max(from.x, to.x + to.width)
  const top = Math.min(sourceY, targetY)
  const bottom = Math.max(sourceY, targetY)

  const blocking = others.filter(
    (box) =>
      box.x + box.width > left &&
      box.x < right &&
      box.y + box.height > top - 2 &&
      box.y < bottom + 2
  )
  if (!blocking.length) return null

  // Above everything in the way, or below it — whichever asks the edge to
  // deviate less from the two ends it is joining.
  const above = Math.min(...blocking.map((box) => box.y)) - clearance
  const below = Math.max(...blocking.map((box) => box.y + box.height)) + clearance
  const cost = (lane: number) =>
    Math.abs(lane - sourceY) + Math.abs(lane - targetY)
  return cost(above) <= cost(below) ? above : below
}

/** Which kinds are worth routing. A one-step-forward edge never needs it. */
export function routable(kind: EdgeKind) {
  return kind === "jump" || kind === "back"
}

/**
 * An orthogonal path through a lane, with rounded corners.
 *
 * `M` out of the source port, up or down into the lane, across, then back to
 * the target port — the shape a person draws when a wire has to get past
 * something.
 */
export function lanePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  lane: number,
  { stub = 24, radius = 12 } = {}
): [string, number, number] {
  const points: Array<[number, number]> = [
    [sourceX, sourceY],
    [sourceX + stub, sourceY],
    [sourceX + stub, lane],
    [targetX - stub, lane],
    [targetX - stub, targetY],
    [targetX, targetY],
  ]
  return [
    roundedPath(points, radius),
    (sourceX + stub + (targetX - stub)) / 2,
    lane,
  ]
}

/** Polyline with arc corners, skipping any segment of zero length. */
function roundedPath(points: Array<[number, number]>, radius: number): string {
  const kept: Array<[number, number]> = []
  for (const point of points) {
    const last = kept[kept.length - 1]
    if (!last || last[0] !== point[0] || last[1] !== point[1]) kept.push(point)
  }
  if (kept.length < 2) return ""

  let path = `M ${kept[0][0]},${kept[0][1]}`
  for (let i = 1; i < kept.length - 1; i += 1) {
    const [px, py] = kept[i - 1]
    const [cx, cy] = kept[i]
    const [nx, ny] = kept[i + 1]
    const inLength = Math.hypot(cx - px, cy - py)
    const outLength = Math.hypot(nx - cx, ny - cy)
    const r = Math.min(radius, inLength / 2, outLength / 2)
    if (r < 1) {
      path += ` L ${cx},${cy}`
      continue
    }
    const from: [number, number] = [
      cx + ((px - cx) / inLength) * r,
      cy + ((py - cy) / inLength) * r,
    ]
    const to: [number, number] = [
      cx + ((nx - cx) / outLength) * r,
      cy + ((ny - cy) / outLength) * r,
    ]
    path += ` L ${from[0]},${from[1]} Q ${cx},${cy} ${to[0]},${to[1]}`
  }
  const end = kept[kept.length - 1]
  return `${path} L ${end[0]},${end[1]}`
}
