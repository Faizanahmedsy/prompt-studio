import { describe, expect, it } from "vitest"

import { starterDoc } from "@/features/library/data/starters"
import { buildScreenPrompt, counterpartsOf } from "@/features/prompt/engine/screen-prompt"
import type { ProjectDoc, Screen } from "@/types/project"

const doc = () => starterDoc("full-system")!
const byKey = (d: ProjectDoc, key: string) =>
  d.screens.find((s) => s.key === key) as Screen

const promptFor = (key: string, d: ProjectDoc = doc()) =>
  buildScreenPrompt(d, byKey(d, key).id)

describe("copying one screen's prompt", () => {
  it("carries the screen's own detail", () => {
    const { text } = promptFor("board")
    expect(text).toContain("Dispatch Board")
    expect(text).toContain("`board`")
    // its modules
    expect(text).toContain("Unassigned")
    expect(text).toContain("drag a job onto an engineer")
  })

  it("carries the user story and its acceptance criteria", () => {
    const { text } = promptFor("board")
    expect(text).toContain("as a dispatcher starting the day")
    expect(text).toContain("an unassigned job is visible without filtering for it")
  })

  it("carries the transitions in and out, named", () => {
    const { text } = promptFor("board")
    expect(text).toContain("Arrives from **Sign In**")
    expect(text).toContain("Leaves to **All Jobs**")
    expect(text).toContain("click All jobs")
  })

  it("always carries the data model", () => {
    const { text } = promptFor("board")
    for (const table of ["users", "customers", "jobs", "job_events"]) {
      expect(text).toContain(`\`${table}\``)
    }
  })

  it("carries stack, design and conventions so it stands alone", () => {
    const { text } = promptFor("board")
    expect(text).toContain("## Tech Stack")
    expect(text).toContain("## Design System")
    expect(text).toContain("## Conventions")
  })

  it("ends with the honesty clause like every other prompt", () => {
    expect(promptFor("board").text).toContain("END TO END INTEGRATION TESTING")
  })
})

describe("reaching the other builds", () => {
  // The whole point: the tab you copied from must not change what you get.
  it("a web screen pulls in the backend it talks to", () => {
    const { text, surfaces } = promptFor("board")
    expect(surfaces).toContain("backend")
    expect(text).toContain("Jobs")
    expect(text).toContain("Endpoints:")
  })

  it("a mobile screen pulls in the backend it talks to", () => {
    const { surfaces } = promptFor("app_job")
    expect(surfaces).toEqual(expect.arrayContaining(["mobile", "backend"]))
  })

  it("a backend screen pulls in every client that calls it", () => {
    const { text, surfaces } = promptFor("api_jobs")
    expect(surfaces).toEqual(expect.arrayContaining(["backend", "web", "mobile"]))
    expect(text).toContain("Dispatch Board")
    expect(text).toContain("Today")
  })

  it("a screen in a flow that spans all three reaches all three", () => {
    const { surfaces } = promptFor("login")
    expect(new Set(surfaces)).toEqual(new Set(["web", "mobile", "backend"]))
  })

  it("says which flow each counterpart was reached through", () => {
    expect(promptFor("api_jobs").text).toContain("shares: Assigning work")
  })

  it("never lists the screen itself as its own counterpart", () => {
    const d = doc()
    const board = byKey(d, "board")
    expect(counterpartsOf(d, board).map((c) => c.screen.id)).not.toContain(board.id)
  })

  it("never lists a same-surface screen as a counterpart", () => {
    const d = doc()
    for (const screen of d.screens) {
      for (const entry of counterpartsOf(d, screen)) {
        expect(entry.surface).not.toBe(screen.surface)
      }
    }
  })

  it("orders the other builds web, mobile, backend regardless of document order", () => {
    const d = doc()
    const order = counterpartsOf(d, byKey(d, "api_jobs")).map((c) => c.surface)
    const rank = { web: 0, mobile: 1, backend: 2 } as Record<string, number>
    for (let i = 1; i < order.length; i++) {
      expect(rank[order[i]]).toBeGreaterThanOrEqual(rank[order[i - 1]])
    }
  })
})

describe("when there is not much to go on", () => {
  it("warns, rather than silently shipping half a brief, for an untagged screen", () => {
    const d = doc()
    const board = byKey(d, "board")
    const stripped = {
      ...d,
      screens: d.screens.map((s) => (s.id === board.id ? { ...s, flows: [] } : s)),
    }
    const built = buildScreenPrompt(stripped, board.id)
    expect(built.surfaces).toEqual(["web"])
    expect(built.warnings[0]).toContain("not tagged to a flow")
  })

  it("still produces a usable brief for an untagged screen", () => {
    const d = doc()
    const board = byKey(d, "board")
    const stripped = {
      ...d,
      screens: d.screens.map((s) => (s.id === board.id ? { ...s, flows: [] } : s)),
    }
    const { text } = buildScreenPrompt(stripped, board.id)
    expect(text).toContain("Dispatch Board")
    expect(text).toContain("## Data Model")
  })

  it("says so when a screen has no parts recorded", () => {
    const d = doc()
    const jobs = byKey(d, "jobs")
    expect(buildScreenPrompt(d, jobs.id).text).toContain("No parts recorded yet")
  })

  it("returns a warning and no text for a screen that has been deleted", () => {
    const built = buildScreenPrompt(doc(), "scr_does_not_exist")
    expect(built.text).toBe("")
    expect(built.warnings[0]).toContain("no longer in the project")
  })

  it("does not throw on a project with a single screen and nothing else", () => {
    const d = doc()
    const only = byKey(d, "board")
    const tiny: ProjectDoc = {
      ...d,
      screens: [{ ...only, flows: [], views: [] }],
      edges: [],
      modules: [],
      flows: [],
      views: [],
    }
    expect(() => buildScreenPrompt(tiny, only.id)).not.toThrow()
  })
})
