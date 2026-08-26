import { describe, expect, it } from "vitest"

import {
  type Box,
  type Point,
  pathFromPoints,
  pathIsClear,
  routeAround,
} from "@/features/builder/utils/edge-routing"

const box = (x: number, y: number, width = 224, height = 216): Box => ({
  x,
  y,
  width,
  height,
})

/** Does any segment of this path cross this card? */
function crosses(points: Point[], rect: Box, pad = 0) {
  const grown = {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    if (
      Math.max(a.x, b.x) > grown.x &&
      Math.min(a.x, b.x) < grown.x + grown.width &&
      Math.max(a.y, b.y) > grown.y &&
      Math.min(a.y, b.y) < grown.y + grown.height
    ) {
      return true
    }
  }
  return false
}

describe("knowing when a path is in the way", () => {
  it("says a clear run is clear", () => {
    expect(pathIsClear(box(0, 0), box(360, 0), [])).toBe(true)
  })

  it("catches a card standing between two on the same row", () => {
    const middle = box(360, 0)
    expect(pathIsClear(box(0, 0), box(720, 0), [middle])).toBe(false)
  })

  it("does not care about a card well out of the way", () => {
    expect(pathIsClear(box(0, 0), box(720, 0), [box(360, 900)])).toBe(true)
  })
})

describe("routing around", () => {
  it("goes around a card in the middle of the row", () => {
    const middle = box(360, 0)
    const points = routeAround(box(0, 0), box(720, 0), [middle])
    expect(points).not.toBeNull()
    expect(crosses(points!, middle)).toBe(false)
  })

  it("goes around a wall of cards", () => {
    const wall = [box(360, -260), box(360, 0), box(360, 260)]
    const points = routeAround(box(0, 0), box(720, 0), wall)
    expect(points).not.toBeNull()
    for (const rect of wall) expect(crosses(points!, rect)).toBe(false)
  })

  it("routes a loop back across three columns", () => {
    const between = [box(240, 0), box(480, 0)]
    const points = routeAround(box(720, 0), box(0, 0), between)
    expect(points).not.toBeNull()
    for (const rect of between) expect(crosses(points!, rect)).toBe(false)
  })

  it("keeps clear of a diagonal it has to cross", () => {
    const middle = box(300, 150)
    const points = routeAround(box(0, 0), box(640, 320), [middle])
    expect(points).not.toBeNull()
    expect(crosses(points!, middle)).toBe(false)
  })

  it("starts at the source's right edge and ends at the target's left", () => {
    const points = routeAround(box(0, 0), box(720, 0), [box(360, 0)])!
    expect(points[0]).toEqual({ x: 224, y: 108 })
    expect(points[points.length - 1]).toEqual({ x: 720, y: 108 })
  })

  it("gives the same answer twice — the canvas re-renders constantly", () => {
    const obstacles = [box(360, 0), box(360, 300)]
    const first = routeAround(box(0, 0), box(720, 0), obstacles)
    const second = routeAround(box(0, 0), box(720, 0), obstacles)
    expect(second).toEqual(first)
  })

  it("survives a card sitting exactly on the target", () => {
    const points = routeAround(box(0, 0), box(400, 0), [box(400, 0)])
    // Either a way round, or nothing — never a crash, and never a path through.
    if (points) expect(crosses(points, box(400, 0), -4)).toBe(false)
  })

  it("routes through ninety obstacles without stalling", () => {
    const obstacles: Box[] = []
    for (let column = 1; column < 10; column += 1) {
      for (let row = 0; row < 10; row += 1) {
        obstacles.push(box(column * 360, row * 260))
      }
    }
    const started = Date.now()
    const points = routeAround(box(0, 0), box(3600, 2340), obstacles)
    expect(Date.now() - started).toBeLessThan(400)
    if (points) {
      for (const rect of obstacles) expect(crosses(points, rect)).toBe(false)
    }
  })
})

describe("drawing the path", () => {
  it("rounds the corners", () => {
    const [path] = pathFromPoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(path.startsWith("M 0,0")).toBe(true)
    expect(path).toContain("Q")
  })

  it("puts the label on the longest straight run", () => {
    const [, x, y] = pathFromPoints([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 400 },
      { x: 40, y: 400 },
    ])
    expect(x).toBe(20)
    expect(y).toBe(200)
  })

  it("says nothing for a path with one point", () => {
    expect(pathFromPoints([{ x: 0, y: 0 }])[0]).toBe("")
  })
})
