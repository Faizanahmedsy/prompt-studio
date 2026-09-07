import { describe, expect, it } from "vitest"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { starterDoc } from "@/features/library/data/starters"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { buildDesignPrompt } from "@/features/theme/design-prompt"
import type { ProjectDoc } from "@/types/project"

/**
 * Two ways to answer one question, and they must not both answer it.
 *
 * `preset` ships a stylesheet; `auto` hands the decision to the agent. A prompt
 * carrying both would be a design and an instruction to invent one, and an
 * agent given both follows whichever it read last — which is the exact failure
 * this project has already been bitten by once.
 */
function doc(mode: "preset" | "auto", id = "saas-dashboard"): ProjectDoc {
  const parsed = starterDoc(id)
  if (!parsed) throw new Error(`starter ${id} did not parse`)
  return { ...parsed, theme: { ...parsed.theme, designMode: mode } }
}

const bodyOf = (built: ReturnType<typeof buildPrompt>, id: string) =>
  built.blocks.find((block) => block.id === id)?.body ?? ""

describe("letting the agent decide", () => {
  const built = buildPrompt(doc("auto"))

  it("ships no stylesheet and no craft rules that assume one", () => {
    expect(built.blocks.find((block) => block.id === "tokens")).toBeUndefined()
    expect(built.blocks.find((block) => block.id === "ui_conventions")).toBeUndefined()
  })

  it("says out loud that the design is the agent's to choose", () => {
    expect(bodyOf(built, "design")).toContain("You own the visual design")
  })

  it("gives a method rather than a palette", () => {
    const design = bodyOf(built, "design")
    expect(design).toContain("Write the design plan before any code")
    expect(design).toContain("four to six colours")
    // A colour, a font or a radius here would be a preset written badly.
    expect(design).not.toMatch(/oklch\(/)
    expect(design).not.toMatch(/--background/)
  })

  it("names the roles the design has to serve", () => {
    const source = doc("auto")
    const named = source.views.map((view) => view.name)
    const design = bodyOf(buildPrompt(source), "design")
    if (named.length) {
      expect(design).toContain(named[0])
      expect(design).toContain("The one thing this person came to do")
    }
  })

  it("replaces a decaying ban list with a test that does not expire", () => {
    const design = bodyOf(built, "design")
    // Every 2025 list named the purple gradient; the current default is
    // cream-and-serif, which those same lists recommended. So the load-bearing
    // rule is the comparison, not the list.
    expect(design).toContain("would I have produced this same answer from a generic prompt")
    expect(design).toContain("terracotta or clay accent")
    expect(design).toContain("Report back with the plan's five decisions")
  })

  it("bans the adjectives that cannot be checked", () => {
    // "Make it beautiful" is satisfied by any output, so it licenses nothing.
    const design = bodyOf(built, "design")
    expect(design).toContain("delete it and write the measurement")
  })

  it("does not reach for a persona, which measures at nothing", () => {
    const design = bodyOf(built, "design")
    expect(design).not.toMatch(/world-class|senior designer|20 years/i)
  })
})

describe("choosing it here is unchanged", () => {
  const built = buildPrompt(doc("preset"))

  it("still ships the stylesheet and the craft rules", () => {
    expect(bodyOf(built, "tokens")).toContain("--background")
    expect(bodyOf(built, "ui_conventions")).toContain("Do not ship any of these")
  })

  it("does not also tell the agent to invent a design", () => {
    expect(bodyOf(built, "design")).not.toContain("you are choosing it")
  })
})

describe("the design-only prompt follows the same choice", () => {
  it("carries the brief and the product, and no screens, in auto", () => {
    const text = buildDesignPrompt(doc("auto"))
    expect(text).toContain("No design has been chosen")
    expect(text).toContain("Write the design plan before any code")
    // The whole reason it is a separate button.
    expect(text).not.toContain("Navigation transitions")
    expect(text).not.toContain("Folder structure")
  })

  it("carries the tokens in preset mode", () => {
    const text = buildDesignPrompt(doc("preset"))
    expect(text).toContain("--background")
    expect(text).not.toContain("No design has been chosen")
  })

  it("defaults to preset, so a project written before this keeps its design", () => {
    const source = starterDoc("saas-dashboard")
    expect(source?.theme.designMode).toBe("preset")
  })
})

describe("the choice survives a round trip through Flow", () => {
  it("writes and reads it back", async () => {
    const { parseFlow } = await import("@/features/flow-lang/parser")
    const source = serializeFlow(doc("auto"))
    expect(source).toContain("decided_by auto")
    const parsed = parseFlow(source)
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.warnings.filter((w) => w.message.includes("decided_by"))).toHaveLength(0)
    expect(parsed.doc.theme.designMode).toBe("auto")
  })

  it("stays out of a file that did not change it", () => {
    // Every other dial is written only when moved, and a line saying "the
    // default" in every file is a line people stop reading.
    expect(serializeFlow(doc("preset"))).not.toContain("decided_by")
  })
})
