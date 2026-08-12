import { describe, expect, it } from "vitest"

import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { starters } from "@/features/library/data/starters"
import type { ProjectDoc } from "@/types/project"

/** Ids and canvas coordinates are regenerated on every parse — compare meaning. */
function normalise(doc: ProjectDoc) {
  const keyOf = new Map(doc.screens.map((s) => [s.id, s.key]))
  return {
    ...doc,
    screens: doc.screens.map(({ id, x, y, ...rest }) => rest),
    edges: doc.edges
      .map(({ id, from, to, trigger }) => ({
        from: keyOf.get(from),
        to: keyOf.get(to),
        trigger,
      }))
      .sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)),
    sections: doc.sections.map(({ id, ...rest }) => rest),
  }
}

describe("flow language round-trip", () => {
  for (const starter of starters) {
    it(`survives serialize → parse for "${starter.name}"`, () => {
      const first = parseFlow(starter.source).doc
      const again = parseFlow(serializeFlow(first)).doc
      expect(normalise(again)).toEqual(normalise(first))
    })
  }
})

describe("parser tolerance", () => {
  it("accepts unicode arrows, missing braces and stray commas", () => {
    const { doc, errors } = parseFlow(`
      app "Messy"
      screen login "Sign In" { template auth }
      screen home  "Home"    { template dashboard }
      flow {
        login → home : "after login"
      }
    `)
    expect(errors).toHaveLength(0)
    expect(doc.screens).toHaveLength(2)
    expect(doc.edges[0].trigger).toBe("after login")
  })

  it("auto-creates screens that are only referenced in the flow", () => {
    const { doc } = parseFlow(`
      screen a "A" { template auth }
      flow { a -> b : "next" }
    `)
    expect(doc.screens.map((s) => s.key)).toEqual(["a", "b"])
    expect(doc.edges).toHaveLength(1)
  })

  it("expands an arrow chain into one edge per hop", () => {
    const { doc } = parseFlow(`flow { a -> b -> c }`)
    expect(doc.edges).toHaveLength(2)
    expect(doc.screens).toHaveLength(3)
  })

  it("fuzzy-matches a mistyped layout instead of dropping it", () => {
    const { doc, warnings } = parseFlow(`
      screen d "Dash" { template dashboard; layout dashboard-sidebr }
    `)
    expect(doc.screens[0].layout).toBe("dashboard-sidebar")
    expect(warnings.some((w) => w.message.includes("dashboard-sidebr"))).toBe(true)
  })

  it("keeps an unrecognisable layout as free text rather than losing intent", () => {
    const { doc } = parseFlow(`
      screen z "Z" { layout something-completely-different-xyz }
    `)
    expect(doc.screens[0].layout).toBe("something-completely-different-xyz")
  })

  it("rejects self-connections and duplicates with a warning", () => {
    const { doc, warnings } = parseFlow(`
      flow {
        a -> a
        a -> b
        a -> b
      }
    `)
    expect(doc.edges).toHaveLength(1)
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })

  it("reads heredoc requirements and hex colours without treating # as a comment", () => {
    const { doc } = parseFlow(`
      app "X" { theme { primary #2563eb } }   # trailing comment
      requirements """
        Line one.
        Line two.
      """
    `)
    expect(doc.theme.primaryColor).toBe("#2563eb")
    expect(doc.requirements).toBe("Line one.\nLine two.")
  })

  it("reports an error when the source contains nothing buildable", () => {
    const { errors } = parseFlow("just some prose, not flow source")
    expect(errors.length).toBeGreaterThan(0)
  })
})
