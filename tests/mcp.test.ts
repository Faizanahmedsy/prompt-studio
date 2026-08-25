import { describe, expect, it } from "vitest"
import { serializeFlow } from "@/features/flow-lang"
import { starterDoc } from "@/features/library/data/starters"
import { applyFlow, checkFlow, newDoc, promptFor, readDoc, toFlow } from "@/mcp/src/flow"

const base = () => starterDoc("saas-dashboard")!

describe("what the MCP server does with Flow", () => {
  it("round-trips a project through its text form", () => {
    const doc = base()
    const source = toFlow(doc)
    const result = checkFlow(source)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.summary).toContain(`${doc.screens.length} screens`)
  })

  it("reads a stored document with fields missing, the way an older row has them", () => {
    const { flows, theme, ...older } = base() as Record<string, unknown>
    void flows
    void theme
    const doc = readDoc(older)
    expect(doc.flows).toEqual([])
    expect(doc.theme).toBeDefined()
  })

  it("refuses a document it cannot read at all", () => {
    expect(() => readDoc({ screens: "not a list" })).toThrow(/could not be read/)
  })

  it("reports a syntax error against the line it is on", () => {
    const result = checkFlow('screen home "Home" {\n  layout list\n}\n}\n')
    expect(result.ok).toBe(false)
    expect(result.errors.join(" ")).toMatch(/line 4/)
  })

  it("a typo that the parser can still read is a warning, not a refusal", () => {
    const result = checkFlow('screen home "Home" {\n  layout not-a-real-layout\n}\n')
    expect(result.ok).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("merging a fragment adds to the project rather than replacing it", () => {
    const doc = base()
    const before = doc.screens.length
    const applied = applyFlow(doc, 'screen billing "Billing" {\n  layout table\n}\n', "merge")
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.doc.screens.length).toBe(before + 1)
    expect(applied.doc.screens.map((screen) => screen.key)).toContain("billing")
  })

  it("merging leaves the caller's own document untouched", () => {
    const doc = base()
    const before = JSON.stringify(doc)
    applyFlow(doc, 'screen billing "Billing" {\n  layout table\n}\n', "merge")
    expect(JSON.stringify(doc)).toBe(before)
  })

  it("replacing means replacing — the fragment becomes the whole project", () => {
    const applied = applyFlow(base(), 'screen billing "Billing" {\n  layout table\n}\n', "replace")
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.doc.screens.map((screen) => screen.key)).toEqual(["billing"])
  })

  it("a write that would not parse changes nothing and says why", () => {
    const applied = applyFlow(base(), "flow -> -> ->\n", "merge")
    expect(applied.ok).toBe(false)
    if (applied.ok) return
    expect(applied.issues.length).toBeGreaterThan(0)
  })

  it("a new project takes the name from the call, not from the source", () => {
    const built = newDoc("Ledger", 'project "Something Else"\n\nscreen home "Home" {\n  layout list\n}\n')
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.doc.name).toBe("Ledger")
    expect(built.doc.screens.map((screen) => screen.key)).toContain("home")
  })

  it("a new project with no source is still a project", () => {
    const built = newDoc("Empty", null)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.doc.name).toBe("Empty")
  })

  it("builds the same prompt the studio does, per surface", () => {
    const doc = base()
    expect(promptFor(doc, "web")).toContain(doc.name)
    expect(promptFor(doc, "mobile")).not.toBe(promptFor(doc, "web"))
  })

  it("what write_flow saves can be read back as Flow again", () => {
    const applied = applyFlow(base(), 'screen billing "Billing" {\n  layout table\n}\n', "merge")
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(checkFlow(serializeFlow(applied.doc)).ok).toBe(true)
  })
})
