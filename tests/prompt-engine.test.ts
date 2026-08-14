import { describe, expect, it } from "vitest"

import { analyseGraph, autoLayout } from "@/features/builder/utils/graph"
import { parseFlow } from "@/features/flow-lang/parser"
import { starterDoc } from "@/features/library/data/starters"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { diffLines, diffStats } from "@/features/prompt/engine/diff"
import { projectDocSchema } from "@/types/project"

const doc = () => starterDoc("saas-dashboard")!

describe("graph analysis", () => {
  it("finds the entry screen and orders the rest by flow", () => {
    const { screens, edges } = doc()
    const { entries, ordered } = analyseGraph(screens, edges)
    expect(entries.map((s) => s.key)).toEqual(["login"])
    expect(ordered[0].key).toBe("login")
    expect(ordered).toHaveLength(screens.length)
  })

  it("flags screens with no connections at all", () => {
    const base = doc()
    const orphan = { ...base.screens[0], id: "orphan", key: "orphan" }
    const { unreachable } = analyseGraph([...base.screens, orphan], base.edges)
    expect(unreachable.map((s) => s.id)).toContain("orphan")
  })

  it("detects a cycle without hanging", () => {
    const { doc: parsed } = parseFlow(`flow { a -> b; b -> c; c -> a }`)
    const { cycles } = analyseGraph(parsed.screens, parsed.edges)
    expect(cycles.length).toBeGreaterThan(0)
  })

  it("auto-layout keeps a cyclic graph inside a sane width", () => {
    // A save-and-return loop must not push columns off to infinity.
    const { doc: parsed } = parseFlow(`
      flow {
        list -> edit : "click a row"
        edit -> list : "on save"
        list -> other
      }
    `)
    const laid = autoLayout(parsed.screens, parsed.edges)
    const widest = Math.max(...laid.map((s) => s.x))
    expect(widest).toBeLessThanOrEqual(280 * parsed.screens.length)
  })

  it("auto-layout puts every screen on a depth column", () => {
    const base = doc()
    const laid = autoLayout(base.screens, base.edges)
    const login = laid.find((s) => s.key === "login")!
    const dashboard = laid.find((s) => s.key === "dashboard")!
    expect(login.x).toBeLessThan(dashboard.x)
    expect(laid).toHaveLength(base.screens.length)
  })
})

describe("prompt engine", () => {
  it("includes every screen and transition in flow order", () => {
    const { text } = buildPrompt(doc())
    expect(text).toContain("Sign In")
    expect(text).toContain("Dashboard")
    expect(text).toContain("on successful login")
    expect(text.indexOf("Sign In")).toBeLessThan(text.indexOf("Settings"))
  })

  it("names the chosen design language and its rules", () => {
    const base = doc()
    const corporate = buildPrompt({
      ...base,
      theme: { ...base.theme, designLanguage: "corporate" },
    }).text
    expect(corporate).toContain("Corporate & precise")
    expect(corporate).toContain("hairline borders")
    expect(corporate).not.toContain("Modern & friendly")
  })

  it("carries the working agreements when their conventions are on", () => {
    const base = doc()
    const { text } = buildPrompt({
      ...base,
      conventions: {
        ...base.conventions,
        ids: ["git-permission", "story-docs", "kt-doc", "reuse-components"],
      },
    })
    expect(text).toContain("without asking for permission first")
    expect(text).toContain("docs/stories/")
    expect(text).toContain("docs/kt.md")
    expect(text).toContain("shared components")
  })

  it("switches format with the target", () => {
    const base = doc()
    const claude = buildPrompt({ ...base, target: "claude-code" }).text
    const v0 = buildPrompt({ ...base, target: "v0" }).text
    expect(claude).toContain("<overview>")
    expect(v0).toContain("## Overview")
    expect(v0).not.toContain("<overview>")
  })

  it("appends the lines of every enabled snippet exactly once", () => {
    const base = { ...doc(), snippetIds: ["a11y", "a11y", "states"] }
    const { text } = buildPrompt(base)
    const occurrences = text.split("Every interactive element is reachable").length - 1
    expect(occurrences).toBe(1)
    expect(text).toContain("layout-shaped skeleton")
  })

  it("warns about missing layouts, lone screens and an empty project", () => {
    const empty = buildPrompt(projectDocSchema.parse({}))
    expect(empty.warnings.join(" ")).toContain("Nothing to build yet")

    const base = doc()
    const noLayout = buildPrompt({
      ...base,
      screens: base.screens.map((s) => ({ ...s, layout: "" })),
    })
    expect(noLayout.warnings.join(" ")).toContain("no layout chosen")
  })

  it("still describes a screen whose layout id is unknown", () => {
    const base = doc()
    const { text } = buildPrompt({
      ...base,
      screens: [{ ...base.screens[0], layout: "made-up-layout" }, ...base.screens.slice(1)],
    })
    expect(text).toContain("made up layout")
  })

  it("drops blocks that have no content", () => {
    const { blocks } = buildPrompt(projectDocSchema.parse({ name: "Bare" }))
    expect(blocks.some((b) => b.id === "screens")).toBe(false)
    expect(blocks.some((b) => b.id === "sections")).toBe(false)
  })
})

describe("diff", () => {
  it("counts added and removed lines", () => {
    const lines = diffLines("a\nb\nc", "a\nc\nd")
    const stats = diffStats(lines)
    expect(stats.removed).toBe(1)
    expect(stats.added).toBe(1)
  })

  it("treats an empty baseline as all additions", () => {
    expect(diffStats(diffLines("", "x\ny")).added).toBe(2)
  })
})
