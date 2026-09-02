/**
 * The check that was missing when the dependency floor vanished from v0.
 *
 * A block reaches a prompt only if its id appears in that target's `order`.
 * A missing id is dropped silently — no error, no warning, and no type error,
 * because `order` is an array and nothing forces it to be exhaustive. That is
 * how the Next.js version floor disappeared for the one builder that scaffolds
 * Next itself, and it is why `security` had to become its own block.
 *
 * So the token contract and the craft rules get an explicit test rather than a
 * comment asking the next person to remember.
 */

import { describe, expect, it } from "vitest"
import { starterDoc } from "@/features/library/data/starters"
import { buildProjectPrompt } from "@/features/prompt/engine/build-project-prompt"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { buildScreenPrompt } from "@/features/prompt/engine/screen-prompt"
import { promptTargets } from "@/features/prompt/engine/targets"
import type { ProjectDoc } from "@/types/project"

/** Every target must carry these; they are the design decision itself. */
const REQUIRED = ["design", "tokens", "ui_conventions"] as const

function doc(id = "saas-dashboard"): ProjectDoc {
  const parsed = starterDoc(id)
  if (!parsed) throw new Error(`starter ${id} did not parse`)
  return parsed
}

describe("the token blocks reach every target", () => {
  for (const target of promptTargets) {
    for (const id of REQUIRED) {
      it(`${target.id} orders "${id}"`, () => {
        expect(target.order).toContain(id)
      })
    }
  }

  for (const target of promptTargets) {
    it(`${target.id} actually renders the stylesheet`, () => {
      const built = buildPrompt({ ...doc(), target: target.id })
      const tokens = built.blocks.find((block) => block.id === "tokens")
      expect(tokens, `${target.id} produced no tokens block`).toBeDefined()
      // The point of the block is that it ships a file, not a description of
      // one. A body with no fence is a body that lost the stylesheet.
      expect(tokens?.body).toContain("```")
      expect(tokens?.body).toContain("--background")
    })
  }
})

describe("the craft rules are checkable, not advisory", () => {
  const built = buildPrompt(doc())
  const craft = built.blocks.find((block) => block.id === "ui_conventions")?.body ?? ""

  it("states the type scale as values", () => {
    expect(craft).toContain("tracking")
    expect(craft).toMatch(/body\s+\d+ \/ \d/)
  })

  it("names banned signatures individually", () => {
    // Each of these has been observed in generated output; the list only works
    // because every line is answerable yes or no about a finished page.
    expect(craft).toContain("gradient")
    expect(craft).toContain("Emoji")
    expect(craft).toContain("lorem ipsum")
  })

  it("designs the states most generated interfaces skip", () => {
    expect(craft).toContain("Empty.")
    expect(craft).toContain("Loading.")
    expect(craft).toContain("focus-visible")
  })

  it("carries a single accent budget rather than telling the agent to be tasteful", () => {
    const tokens = built.blocks.find((block) => block.id === "tokens")?.body ?? ""
    expect(tokens).toContain("10% of any viewport")
  })
})

describe("basic and backend stand down", () => {
  it("the basic design language emits neither block", () => {
    const basic = doc()
    basic.theme.designLanguage = "basic"
    const built = buildPrompt(basic)
    expect(built.blocks.find((b) => b.id === "tokens")).toBeUndefined()
    expect(built.blocks.find((b) => b.id === "ui_conventions")).toBeUndefined()
  })

  it("a backend build has no stylesheet", () => {
    const built = buildPrompt(doc("full-system"), { surface: "backend" })
    expect(built.blocks.find((b) => b.id === "tokens")).toBeUndefined()
  })
})

describe("multi-build states the stylesheet once", () => {
  it("emits one tokens section for the whole system", () => {
    const built = buildProjectPrompt(doc("full-system"))
    const count = built.blocks.filter((block) => block.id === "tokens").length
    expect(count).toBe(1)
  })
})

describe("the screen brief carries the contract", () => {
  it("a screen prompt includes the tokens", () => {
    const source = doc()
    const screen = source.screens[0]
    const built = buildScreenPrompt(source, screen.id)
    expect(built.text).toContain("Design Tokens")
    expect(built.text).toContain("Interface Craft")
  })
})

describe("ui-first trims what a prototype does not want", () => {
  it("drops the data model and the deployment section", () => {
    const ui = { ...doc("full-system"), priority: "ui-first" as const }
    const built = buildPrompt(ui)
    expect(built.blocks.find((b) => b.id === "data_model")).toBeUndefined()
    expect(built.blocks.find((b) => b.id === "deployment")).toBeUndefined()
  })

  it("keeps the design decision itself", () => {
    const ui = { ...doc(), priority: "ui-first" as const }
    const built = buildPrompt(ui)
    expect(built.blocks.find((b) => b.id === "tokens")).toBeDefined()
    expect(built.blocks.find((b) => b.id === "ui_conventions")).toBeDefined()
  })

  it("logic-first is unchanged", () => {
    // A starter with tables in it: the data-model block drops itself when a
    // project has no entities, so a starter without them proves nothing here.
    const built = buildPrompt(doc("full-system"))
    expect(built.blocks.find((b) => b.id === "data_model")).toBeDefined()
  })
})
