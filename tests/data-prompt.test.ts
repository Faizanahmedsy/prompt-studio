import { describe, expect, it } from "vitest"

import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { buildFragmentPrompt } from "@/features/flow-lang/fragment-prompt"
import { parseFlow } from "@/features/flow-lang/parser"
import { buildReverseEnginePrompt } from "@/features/flow-lang/reverse-prompt"
import { starterDoc } from "@/features/library/data/starters"
import { buildProjectPrompt } from "@/features/prompt/engine/build-project-prompt"
import { buildPrompt, collectWarnings } from "@/features/prompt/engine/build-prompt"

const system = () => starterDoc("full-system")!

describe("the schema reaches the prompt", () => {
  it("writes every table, with its columns and rules", () => {
    const { text } = buildProjectPrompt(system())
    expect(text).toContain("`jobs`")
    expect(text).toContain("| `reference` |")
    expect(text).toContain("primary key")
    expect(text).toContain("unique")
  })

  it("spells the types the way the chosen database does", () => {
    // The full-system starter is on Postgres — `timestamptz`, not `timestamp`.
    const { text } = buildProjectPrompt(system())
    expect(text).toContain("timestamptz")
  })

  it("writes each relation with its delete behaviour", () => {
    const { text } = buildProjectPrompt(system())
    expect(text).toContain("`jobs.customer_id` → `customers.id`")
    expect(text).toContain("deleting the parent deletes these rows")
    expect(text).toContain("deleting the parent is blocked")
    expect(text).toContain("leaves these rows with a null reference")
  })

  it("hands over the shapes as TypeScript, once", () => {
    const { text } = buildProjectPrompt(system())
    expect(text).toContain("export type Job = {")
    expect(text).toContain('status: "unassigned" | "assigned"')
    expect(text.match(/export type Job = \{/g)).toHaveLength(1)
  })

  it("states the schema once for the whole system, not once per build", () => {
    const { blocks } = buildProjectPrompt(system())
    expect(blocks.filter((block) => block.id === "data_model")).toHaveLength(1)
  })

  it("says the service owns the database", () => {
    const { text } = buildProjectPrompt(system())
    expect(text).toContain("only thing that touches the database")
  })

  it("carries the model into a single-build prompt too", () => {
    const doc = system()
    const { text } = buildPrompt(
      { ...doc, builds: { web: true, mobile: false, backend: false } },
      { surface: "web" }
    )
    // The Claude Code target is XML, so the section is a tag rather than a
    // heading — the block id is what matters either way.
    expect(text).toContain("<data_model>")
    expect(text).toContain("`jobs`")
  })

  it("says nothing at all when the project stores nothing", () => {
    const { text, blocks } = buildPrompt(starterDoc("saas-dashboard")!)
    expect(blocks.some((block) => block.id === "data_model")).toBe(false)
    expect(text).not.toContain("<data_model>")
  })
})

describe("checks", () => {
  it("complains about a service with no tables behind it", () => {
    const doc = system()
    const { warnings } = buildProjectPrompt({ ...doc, entities: [], relations: [] })
    expect(warnings.some((w) => w.includes("no tables are drawn"))).toBe(true)
  })

  it("reports a schema error that would break the migration", () => {
    const doc = parseFlow(`
data { table t "T" { name text } }
screen home "Home" {}
`).doc
    expect(collectWarnings(doc).some((w) => w.includes("primary key"))).toBe(true)
  })

  it("leaves a well-formed system with nothing to fix", () => {
    expect(buildProjectPrompt(system()).warnings).toEqual([])
  })
})

describe("the prompts that write Flow", () => {
  it("teaches the requirements prompt to write a data block", () => {
    const text = buildAuthoringPrompt()
    expect(text).toContain("data {")
    expect(text).toContain("rel clients.owner_id -> users.id")
    expect(text).toContain("many-to-many")
    expect(text).toContain("## column types")
  })

  it("tells the reverse prompt where a schema actually lives", () => {
    const text = buildReverseEnginePrompt()
    expect(text).toContain("Phase 3b — the data model")
    expect(text).toContain("migrations")
    expect(text).toContain("schema.prisma")
    // And not to invent one when there is no database at all.
    expect(text).toContain("omit the \\`data\\` block".replace(/\\/g, ""))
  })

  it("lists the existing tables in the merge prompt so a fragment attaches", () => {
    const text = buildFragmentPrompt(system())
    expect(text).toContain("The tables it already has")
    expect(text).toContain("`jobs`")
    expect(text).toContain("only the new columns")
  })

  it("still works on a project that has no tables yet", () => {
    const text = buildFragmentPrompt(starterDoc("saas-dashboard")!)
    expect(text).toContain("this project has no tables yet")
  })
})
