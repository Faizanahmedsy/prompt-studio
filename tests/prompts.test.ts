import { describe, expect, it } from "vitest"

import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { buildFragmentPrompt } from "@/features/flow-lang/fragment-prompt"
import { parseFlow } from "@/features/flow-lang/parser"
import { buildReverseEnginePrompt } from "@/features/flow-lang/reverse-prompt"
import { allLayouts } from "@/features/library/data/layouts"
import { moduleKinds } from "@/features/library/data/module-kinds"
import { starterDoc } from "@/features/library/data/starters"
import { screenTemplates } from "@/features/library/data/templates"

/**
 * Every fenced block in a prompt is an example the model will copy. An example
 * that does not parse teaches it broken syntax, and nothing else in the app
 * would catch that — so each one is run through the real parser here.
 */
function flowExamples(prompt: string): string[] {
  const blocks = prompt.match(/```[a-z]*\n[\s\S]*?```/g) ?? []
  return blocks
    .map((block) => block.replace(/^```[a-z]*\n/, "").replace(/```$/, ""))
    .filter((body) => /^\s*(app|screen|flow)\b/m.test(body))
    // Shell snippets in the reverse prompt are not Flow source.
    .filter((body) => !/^\s*(rg|grep|find)\b/m.test(body))
}

const prompts = {
  authoring: buildAuthoringPrompt(),
  reverse: buildReverseEnginePrompt(),
  fragment: buildFragmentPrompt(starterDoc("admin-crud")!),
}

describe("prompt examples are valid Flow source", () => {
  for (const [name, prompt] of Object.entries(prompts)) {
    it(`${name}: every example parses without errors`, () => {
      const examples = flowExamples(prompt)
      expect(examples.length).toBeGreaterThan(0)
      for (const example of examples) {
        const { errors } = parseFlow(example)
        expect(errors, `in ${name} example:\n${example}`).toEqual([])
      }
    })

    it(`${name}: examples only use ids the app knows`, () => {
      const templateIds = new Set(screenTemplates.map((t) => t.id))
      const layoutIds = new Set(allLayouts.map((l) => l.id))
      const kindIds = new Set(moduleKinds.map((k) => k.id))

      for (const example of flowExamples(prompt)) {
        const { doc, warnings } = parseFlow(example)
        for (const screen of doc.screens) {
          if (screen.template) expect(templateIds.has(screen.template)).toBe(true)
          if (screen.layout) expect(layoutIds.has(screen.layout)).toBe(true)
        }
        for (const module of doc.modules) {
          expect(kindIds.has(module.kind)).toBe(true)
        }
        // A fuzzy match means the example contained a typo the parser silently
        // corrected — the model would copy the typo, not the correction.
        expect(
          warnings.filter((w) => w.message.includes("Unknown")),
          `in ${name} example:\n${example}`
        ).toEqual([])
      }
    })
  }
})

describe("the reverse-engineer prompt", () => {
  const prompt = prompts.reverse

  it("lists every module kind, template and screen layout", () => {
    for (const kind of moduleKinds) expect(prompt).toContain(`- ${kind.id} —`)
    for (const template of screenTemplates) {
      expect(prompt).toContain(`- ${template.id} —`)
    }
    for (const layout of allLayouts.filter((l) => l.scope === "screen")) {
      expect(prompt).toContain(`- ${layout.id}`)
    }
  })

  it("covers both frontend and backend discovery", () => {
    expect(prompt).toMatch(/app\/\*\*\/page/)
    expect(prompt).toContain("urlpatterns")
    expect(prompt).toContain("@(Get|Post|Put|Patch|Delete|Controller)")
    expect(prompt).toContain("kind api")
    expect(prompt).toContain("kind job")
  })

  it("states the rules that keep the output faithful to the code", () => {
    // Enumerate before describing — the fix for silently stopping half way.
    expect(prompt).toContain("before describing any of them")
    // Coverage over depth on a big repo.
    expect(prompt).toContain("CONTINUES:")
    // The modal/route distinction, the most common error.
    expect(prompt).toContain("A modal opening is **always** `inner`")
    // Citations, and the count self-check.
    expect(prompt).toContain("src: <path>")
    expect(prompt).toContain("Does your screen count match the route count")
    // Route-group and dynamic-segment traps.
    expect(prompt).toContain("Route groups are not segments")
    expect(prompt).toContain("A dynamic segment is one screen, not many")
  })
})

describe("the fragment prompt", () => {
  it("embeds the project's real keys so a fragment can attach", () => {
    const doc = starterDoc("admin-crud")!
    const prompt = buildFragmentPrompt(doc)
    for (const screen of doc.screens) {
      expect(prompt).toContain(`\`${screen.key}\``)
    }
    // Modules too, so it does not re-declare one that already exists.
    for (const module of doc.modules) {
      expect(prompt).toContain(`\`${module.key}\``)
    }
    expect(prompt).toContain("Fragment only")
  })

  it("still produces something usable for an empty project", () => {
    const prompt = buildFragmentPrompt(
      starterDoc("blank") ?? ({ screens: [], modules: [] } as never)
    )
    expect(prompt).toContain("Fragment only")
  })
})

describe("choosing which builds to produce", () => {
  it("tells the authoring prompt to pick surfaces from the requirements", () => {
    const prompt = buildAuthoringPrompt()
    expect(prompt).toContain("Decide which builds the product needs")
    // The signals that should map to a phone app.
    for (const cue of ["on their phone", "iOS/Android", "camera", "GPS"]) {
      expect(prompt).toContain(cue)
    }
    expect(prompt).toContain("Most real products need **more than one**")
    // And the rule that keeps builds apart.
    expect(prompt).toContain("Never draw a `flow` arrow from one build to another")
  })

  it("shows a worked example with two builds in one file", () => {
    const prompt = buildAuthoringPrompt()
    expect(prompt).toContain("one product, two builds")
    expect(prompt).toContain("surface mobile")
    expect(prompt).toMatch(/layout\s+mobile-detail/)
  })

  it("names the mobile layouts rather than leaving them to be guessed", () => {
    const prompt = buildAuthoringPrompt()
    for (const id of ["mobile-auth", "mobile-tabs", "mobile-list", "mobile-sheet"]) {
      expect(prompt).toContain(id)
    }
  })

  it("tells the fragment prompt which build each screen is on", () => {
    const doc = starterDoc("mobile-app")!
    const prompt = buildFragmentPrompt(doc)
    expect(prompt).toContain("· mobile")
    expect(prompt).toContain("Say which build each new screen belongs to")
  })
})
