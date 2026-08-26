import { describe, expect, it } from "vitest"

import {
  autoLayout,
  classifyEdges,
  layerScreens,
} from "@/features/builder/utils/graph"
import { parseFlow } from "@/features/flow-lang/parser"
import type { FlowEdge, Screen } from "@/types/project"

/** A bare screen — only the fields the layout maths reads. */
function screen(id: string, patch: Partial<Screen> = {}): Screen {
  return {
    id,
    key: id,
    title: id,
    template: "blank",
    layout: "",
    surface: "web",
    notes: "",
    sections: [],
    flows: [],
    views: [],
    story: { role: "", goal: "", reason: "", acceptance: [] },
    x: 0,
    y: 0,
    ...patch,
  } as Screen
}

function edge(from: string, to: string, id = `${from}->${to}`): FlowEdge {
  return { id, from, to, trigger: "" } as FlowEdge
}

const HEIGHT = 168
const overlaps = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  height = HEIGHT
) => a.x === b.x && Math.abs(a.y - b.y) < height

describe("columns", () => {
  it("puts a screen right of its deepest parent, not its first one", () => {
    // a → b → c and a → c. Shortest-path layering put c beside b and drew the
    // long edge backwards through it; longest-path puts c after both.
    const screens = ["a", "b", "c"].map((id) => screen(id))
    const edges = [edge("a", "b"), edge("b", "c"), edge("a", "c")]
    const { depth } = layerScreens(screens, edges)
    expect(depth.get("a")).toBe(0)
    expect(depth.get("b")).toBe(1)
    expect(depth.get("c")).toBe(2)
  })

  it("treats a return edge as a loop rather than a step forward", () => {
    const screens = ["list", "edit"].map((id) => screen(id))
    const edges = [edge("list", "edit"), edge("edit", "list")]
    const { depth, backEdges } = layerScreens(screens, edges)
    expect(depth.get("list")).toBe(0)
    expect(depth.get("edit")).toBe(1)
    expect([...backEdges]).toEqual(["edit->list"])
  })

  it("survives a screen that points at itself", () => {
    const screens = [screen("a")]
    const { depth } = layerScreens(screens, [edge("a", "a")])
    expect(depth.get("a")).toBe(0)
  })

  it("ignores an edge whose other end was deleted", () => {
    const screens = [screen("a")]
    const laid = autoLayout(screens, [edge("a", "ghost"), edge("ghost", "a")])
    expect(laid[0].x).toBe(0)
    expect(laid[0].y).toBe(0)
  })

  it("lays out a chain of 500 screens without blowing the stack", () => {
    const screens = Array.from({ length: 500 }, (_, i) => screen(`s${i}`))
    const edges = screens.slice(1).map((s, i) => edge(`s${i}`, s.id))
    const laid = autoLayout(screens, edges)
    expect(laid).toHaveLength(500)
    expect(laid[499].x).toBeGreaterThan(laid[0].x)
  })

  it("keeps a cycle with no entry at all on screen", () => {
    // Every screen has an incoming edge, so there is no natural first column.
    const screens = ["a", "b", "c"].map((id) => screen(id))
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")]
    const laid = autoLayout(screens, edges)
    expect(laid).toHaveLength(3)
    expect(laid.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true)
  })
})

describe("nothing overlaps", () => {
  it("stacks screens that share a column clear of each other", () => {
    const screens = ["root", "a", "b", "c", "d"].map((id) => screen(id))
    const edges = ["a", "b", "c", "d"].map((id) => edge("root", id))
    const laid = autoLayout(screens, edges)
    for (const one of laid) {
      for (const other of laid) {
        if (one.id === other.id) continue
        expect(overlaps(one, other)).toBe(false)
      }
    }
  })

  it("leaves room for a screen that is showing its modules", () => {
    const screens = ["root", "tall", "short"].map((id) => screen(id))
    const edges = [edge("root", "tall"), edge("root", "short")]
    const laid = autoLayout(screens, edges, {
      heights: { tall: 700, short: 168, root: 168 },
    })
    const tall = laid.find((s) => s.id === "tall")!
    const short = laid.find((s) => s.id === "short")!
    expect(short.x).toBe(tall.x)
    expect(short.y).toBeGreaterThanOrEqual(tall.y + 700)
  })

  it("never leaves a screen above the top-left corner", () => {
    const screens = ["a", "b", "c", "d"].map((id) => screen(id))
    const edges = [edge("a", "c"), edge("b", "c"), edge("c", "d")]
    const laid = autoLayout(screens, edges)
    expect(Math.min(...laid.map((s) => s.y))).toBe(0)
    expect(Math.min(...laid.map((s) => s.x))).toBe(0)
  })

  it("gives a narrow surface a narrower column pitch", () => {
    const screens = ["a", "b"].map((id) => screen(id, { surface: "mobile" }))
    const edges = [edge("a", "b")]
    const wide = autoLayout(screens, edges, { nodeWidth: 224 })
    const narrow = autoLayout(screens, edges, { nodeWidth: 168 })
    expect(narrow.find((s) => s.id === "b")!.x).toBeLessThan(
      wide.find((s) => s.id === "b")!.x
    )
  })

  it("sizes a column from the widest node in it", () => {
    const screens = ["a", "b"].map((id) => screen(id))
    const laid = autoLayout(screens, [edge("a", "b")], {
      widths: { a: 400 },
    })
    expect(laid.find((s) => s.id === "b")!.x).toBe(400 + 136)
  })
})

describe("crossings", () => {
  it("keeps a screen next to whatever leads into it", () => {
    // Two independent two-step journeys. Laid out naively they interleave and
    // their edges cross; the barycentre sweeps should keep each pair level.
    const screens = ["a1", "a2", "b1", "b2"].map((id) => screen(id))
    const edges = [edge("a1", "a2"), edge("b1", "b2")]
    const laid = autoLayout(screens, edges)
    const at = (id: string) => laid.find((s) => s.id === id)!
    expect(at("a2").y).toBe(at("a1").y)
    expect(at("b2").y).toBe(at("b1").y)
  })
})

describe("relation colours", () => {
  const graph = () =>
    parseFlow(`
flow {
  login -> list   : "sign in"
  list  -> detail : "click a row"
  list  -> help   : "click help"
  detail -> list  : "on save"
  login -> detail : "deep link"
}
`).doc

  it("names each connection by what it does", () => {
    const { screens, edges } = graph()
    const id = (from: string, to: string) =>
      edges.find(
        (e) =>
          screens.find((s) => s.id === e.from)?.key === from &&
          screens.find((s) => s.id === e.to)?.key === to
      )!.id
    const kinds = classifyEdges(screens, edges)

    expect(kinds.get(id("login", "list"))).toBe("branch")
    expect(kinds.get(id("list", "detail"))).toBe("branch")
    expect(kinds.get(id("detail", "list"))).toBe("back")
    expect(kinds.get(id("login", "detail"))).toBe("jump")
  })

  it("calls a lone step forward a next step", () => {
    const screens = ["a", "b"].map((id) => screen(id))
    const kinds = classifyEdges(screens, [edge("a", "b")])
    expect(kinds.get("a->b")).toBe("next")
  })

  it("says nothing about an edge whose ends are gone", () => {
    const kinds = classifyEdges([screen("a")], [edge("a", "ghost")])
    expect(kinds.size).toBe(0)
  })
})
