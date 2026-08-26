import { describe, expect, it } from "vitest"

import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { buildFragmentPrompt } from "@/features/flow-lang/fragment-prompt"
import { parseFlow } from "@/features/flow-lang/parser"
import { buildReverseEnginePrompt } from "@/features/flow-lang/reverse-prompt"
import { allLayouts } from "@/features/library/data/layouts"
import { moduleKinds } from "@/features/library/data/module-kinds"
import { starterDoc } from "@/features/library/data/starters"
import { screenTemplates } from "@/features/library/data/templates"
import { buildFigmaImportPrompt } from "@/features/theme/figma-prompt"
import type { ProjectDoc } from "@/types/project"

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

  it("documents every theme key, so a brief can have a look of its own", () => {
    const prompt = buildAuthoringPrompt()
    // These seven were in the schema and the design block but in neither
    // prompt, so no model ever wrote one and every brief came out with the
    // same soft-modern defaults.
    for (const key of ["headings", "body", "scale", "icons", "elevation", "motion", "scheme"]) {
      expect(prompt).toContain(`\`${key}\``)
    }
    expect(prompt).toContain("dark-first")
    expect(prompt).toContain("expressive")
  })

  it("gives the reverse prompt the same described layout catalogue", () => {
    const prompt = buildReverseEnginePrompt()
    for (const layout of allLayouts.filter((l) => l.scope === "screen")) {
      expect(prompt).toContain(`\`${layout.id}\` — ${layout.name}: ${layout.description}`)
    }
  })

  it("groups the layouts so the shape of the catalogue is visible", () => {
    const prompt = buildAuthoringPrompt()
    // Categories, not one flat list of twenty-eight: a model choosing a layout
    // should be able to see that a wizard and a kanban board exist at all.
    const categories = new Set(
      allLayouts.filter((l) => l.scope === "screen").map((l) => l.category)
    )
    expect(categories.size).toBeGreaterThan(3)
    for (const category of categories) expect(prompt).toContain(`**${category}**`)
  })

  it("lists every module kind, template and screen layout", () => {
    for (const kind of moduleKinds) expect(prompt).toContain(`- ${kind.id} —`)
    for (const template of screenTemplates) {
      expect(prompt).toContain(`- ${template.id} —`)
    }
    for (const layout of allLayouts.filter((l) => l.scope === "screen")) {
      // Id *and* the sentence that explains it. Bare ids left two thirds of
      // the catalogue unreachable — a model cannot choose `table-master-detail`
      // over `table-advanced` from the names alone.
      expect(prompt).toContain(`\`${layout.id}\` — ${layout.name}: ${layout.description}`)
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

  it("shows a worked example with every build in one file", () => {
    const prompt = buildAuthoringPrompt()
    expect(prompt).toContain("one product, three builds")
    expect(prompt).toContain("surface mobile")
    expect(prompt).toContain("surface backend")
    expect(prompt).toMatch(/layout\s+mobile-detail/)
  })

  it("declares the builds, and gives each one its own stack", () => {
    const prompt = buildAuthoringPrompt()
    // Without the declaration the tool cannot tell a product that ships an API
    // from one where somebody tagged a screen `surface backend` by accident.
    expect(prompt).toContain("builds web, mobile, backend")
    expect(prompt).toContain("stack mobile {")
    expect(prompt).toContain("stack backend {")
    expect(prompt).toContain("structure backend src-layered")
  })

  it("says what a backend screen is, since it is not a page", () => {
    const prompt = buildAuthoringPrompt()
    expect(prompt).toContain("A backend \"screen\" is a service area, not a page")
    // And the service technology it has to choose.
    for (const key of ["database", "orm", "apiStyle", "apiAuth"]) {
      expect(prompt).toContain(`\`${key}\``)
    }
  })

  it("no longer tells the reader to fix the mobile stack up in the app afterwards", () => {
    // The old worked example said to set it on the Mobile tab after importing,
    // which was an admission that the format could not carry it.
    expect(buildAuthoringPrompt()).not.toContain("after importing")
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

describe("the shell snippets the reverse prompt hands to ripgrep", () => {
  /**
   * These are regexes written inside a template literal, so `\.` and `\(` in
   * the source are dropped before the string ever exists — the escape has to be
   * `\\.` and `\\(` to survive. Three of them were not, which turned `\(` into
   * an unterminated group: `rg` answers with a syntax error and the model reads
   * an empty result as "this project has none of those".
   *
   * The assertions run against the GENERATED prompt for exactly that reason.
   * Checking the source would pass while the output stayed broken.
   */
  const prompt = prompts.reverse

  function shellPatterns(source: string): { line: string; pattern: string }[] {
    return (source.match(/```bash\n[\s\S]*?```/g) ?? [])
      .flatMap((block) => block.split("\n"))
      .filter((line) => /^\s*(rg|grep|find)\b/.test(line))
      .map((line) => ({ line, pattern: line.match(/'([^']*)'/)?.[1] ?? "" }))
      .filter((entry) => entry.pattern !== "")
  }

  it("emits patterns ripgrep can actually parse", () => {
    const patterns = shellPatterns(prompt)
    expect(patterns.length).toBeGreaterThan(10)

    for (const { line, pattern } of patterns) {
      const opens = (pattern.match(/(?<!\\)\(/g) ?? []).length
      const closes = (pattern.match(/(?<!\\)\)/g) ?? []).length
      expect(opens, `unbalanced brackets — rg would refuse this: ${line}`).toBe(closes)
    }
  })

  it("keeps the escapes that make a dot mean a dot", () => {
    // `navigation.` matches navigationRef, navigationState and every other
    // near-miss; `navigation\.` is what was meant.
    expect(prompt).toContain("navigation\\.(navigate")
    expect(prompt).toContain("\\.sheet\\(")
    expect(prompt).toContain("present\\(")
  })
})

describe("asking the model for journeys and stories", () => {
  it("tells the authoring prompt to produce both diagrams from one file", () => {
    const p = prompts.authoring
    expect(p).toContain("two diagrams")
    expect(p).toContain("whole-app")
    expect(p).toContain("flow-wise")
    expect(p).toMatch(/Name the journeys before you name the screens/i)
  })

  it("requires a flow tag on every screen and a story on both", () => {
    const p = prompts.authoring
    expect(p).toMatch(/Every screen carries at least one .*flows/i)
    expect(p).toMatch(/story \{ … \}. for every screen and every flow/i)
    expect(p).toContain("3–6 acceptance criteria")
  })

  it("warns the model off confusing a journey with a role", () => {
    for (const p of [prompts.authoring, prompts.reverse]) {
      expect(p).toMatch(/a flow is (not|a journey, never) a role/i)
    }
  })

  it("tells the reverse prompt to describe what the code does, not what it should", () => {
    const p = prompts.reverse
    expect(p).toMatch(/Say what the code does, not what it ought to do/i)
    expect(p).toMatch(/Never invent a criterion/i)
  })

  it("gives the fragment prompt the project's existing journeys", () => {
    const doc = parseFlow(`
      flows { flow auth "Authentication" {} }
      screen login "Sign In" { flows [auth] }
    `).doc
    const p = buildFragmentPrompt(doc)
    expect(p).toContain("`auth`")
    expect(p).toContain("Authentication")
    expect(p).toMatch(/inventing .authentication. beside an existing .auth./i)
  })

  it("every complete worked example tags all of its screens into a journey", () => {
    // The complete examples — the ones that open with `app "…"` — are what the
    // model copies wholesale. One that skips the tag teaches that the tag is
    // optional, and the demonstration beats the rule every time.
    //
    // The focused snippets are deliberately exempt: the three lines showing
    // what `surface` does, or the `views` block showing role tags, teach one
    // keyword each, and padding them with unrelated syntax is how an example
    // stops being readable.
    let checked = 0
    for (const [name, prompt] of Object.entries(prompts)) {
      for (const example of flowExamples(prompt)) {
        if (!/^\s*app\s+"/m.test(example)) continue
        checked += 1
        const { doc } = parseFlow(example)
        const untagged = doc.screens.filter((s) => !s.flows.length)
        expect(
          untagged.map((s) => s.key),
          `untagged screens in a ${name} example`
        ).toEqual([])
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe("the Figma import prompt", () => {
  const doc = starterDoc("saas-dashboard")!

  it("names the file it writes and the tokens the project already uses", () => {
    const p = buildFigmaImportPrompt(doc)
    expect(p).toContain("app/globals.css")
    expect(p).toContain("--primary / --primary-foreground")
    expect(p).toContain("@theme inline")
  })

  it("follows the styling choice to a different file and a different shape", () => {
    const mui = buildFigmaImportPrompt({
      ...doc,
      stack: { ...doc.stack, styling: "mui" },
    })
    expect(mui).toContain("styles/theme.ts")
    expect(mui).toContain("createTheme")
    expect(mui).not.toContain("@theme inline")
  })

  it("asks for a whole file, and for the guesses to be declared", () => {
    const p = buildFigmaImportPrompt(doc)
    expect(p).toMatch(/Output the whole file/i)
    expect(p).toMatch(/what you measured and what you guessed/i)
    expect(p).toMatch(/Never name a licensed typeface/i)
  })

  it("drops the dark-theme rule when the project ships light only", () => {
    const light = buildFigmaImportPrompt({
      ...doc,
      theme: { ...doc.theme, colorScheme: "light" },
    })
    expect(light).toContain("do not add a dark block")
    expect(light).not.toMatch(/Design the dark theme, do not invert it/i)

    const both = buildFigmaImportPrompt(doc)
    expect(both).toMatch(/Design the dark theme, do not invert it/i)
  })

  it("does not ask for the CSS to be brought back into Prompt Studio", () => {
    // The stylesheet goes straight into the developer's repository. A prompt
    // that told Claude to hand it back would describe a round trip that does
    // not exist.
    const p = buildFigmaImportPrompt(doc)
    expect(p).not.toMatch(/paste .* back into Prompt Studio/i)
    expect(p).toContain("Do not touch any other file.")
  })
})

describe("the merge prompt knows what the project ships", () => {
  const withBuilds = (builds: Partial<ProjectDoc["builds"]>) => {
    const base = starterDoc("saas-dashboard")!
    return buildFragmentPrompt({
      ...base,
      builds: { web: true, mobile: false, backend: false, ...builds },
    })
  }

  it("names the builds, so a fragment cannot invent one", () => {
    expect(withBuilds({})).toContain("a web app")
    expect(withBuilds({ mobile: true, backend: true })).toContain(
      "a web app, a mobile app and a backend service"
    )
  })

  it("explains what a backend screen is, but only when there is one", () => {
    expect(withBuilds({ backend: true })).toContain("a service area, not a page")
    expect(withBuilds({})).not.toContain("a service area, not a page")
  })

  it("forbids a fragment from resetting the project's decisions", () => {
    // A fragment that restates `stack` or `theme` silently reverts choices the
    // project already made — merge fills blanks, but these are not blank.
    expect(withBuilds({})).toContain("Do not touch the stack")
  })
})

describe("the requirements prompt knows what was already chosen", () => {
  it("still asks the model to decide when nothing is known", () => {
    // Copied from a blank slate — there is no project to defer to.
    const prompt = buildAuthoringPrompt()
    expect(prompt).not.toContain("Already decided")
    expect(prompt).toContain("Decide which builds the product needs")
  })

  it("states the chosen builds as settled, and overrides the rule that asks", () => {
    const doc = starterDoc("full-system")!
    const prompt = buildAuthoringPrompt(doc)
    expect(prompt).toContain("Already decided")
    expect(prompt).toContain("builds web, mobile, backend")
    // A model told to decide will decide, and hand back a file that disagrees
    // with the project it is being pasted into.
    expect(prompt).toContain("It does not apply here — the decision is made")
  })

  it("hands back the service's technology verbatim rather than a suggestion", () => {
    const prompt = buildAuthoringPrompt(starterDoc("full-system")!)
    expect(prompt).toContain("stack backend {")
    expect(prompt).toContain("framework  fastapi")
    expect(prompt).toContain("database   postgres")
    expect(prompt).toContain("apiStyle   rest-openapi")
    expect(prompt).toContain("do not substitute something you would have picked instead")
  })

  it("says nothing about a service when the project does not ship one", () => {
    const prompt = buildAuthoringPrompt(starterDoc("saas-dashboard")!)
    // Scoped to the decided section: the grammar reference further down still
    // shows a `stack backend` block, and should — it is teaching the syntax.
    const decided = prompt.slice(
      prompt.indexOf("# Already decided"),
      prompt.indexOf("# Output rules")
    )
    expect(decided).toContain("builds web")
    expect(decided).not.toContain("stack backend")
  })
})
