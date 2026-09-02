import { describe, expect, it } from "vitest"

import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { describeMerge, mergeDoc } from "@/features/flow-lang/merge"
import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { starterDoc } from "@/features/library/data/starters"
import { presets } from "@/features/theme/data/presets"
import { buildDesignPrompt } from "@/features/theme/design-prompt"
import { resolveTokens } from "@/features/theme/tokens"

/**
 * A design decided by a model, carried in the file, reviewed by a person.
 *
 * The pieces existed — the format could express a theme and the parser could
 * read one — but the two ends were not joined: the guide never asked for a
 * design, so nothing arrived; and merge dropped the theme, so anything that did
 * arrive was thrown away unless you replaced the whole project.
 */
const doc = () => {
  const parsed = starterDoc("saas-dashboard")
  if (!parsed) throw new Error("no starter")
  return parsed
}

const parse = (source: string) => {
  const result = parseFlow(source)
  expect(result.errors, JSON.stringify(result.errors)).toHaveLength(0)
  return result
}

describe("the guide asks for a design and names the options", () => {
  const guide = buildAuthoringPrompt()

  it("lists every preset, so the choice is from a menu", () => {
    // A preset added without a line here is a preset no model can pick, and the
    // failure is silent: an invented name falls back to the default.
    for (const preset of presets) {
      expect(guide, `${preset.id} missing from the guide`).toContain(`\`${preset.id}\``)
    }
  })

  it("says what each one is, not just its id", () => {
    expect(guide).toContain(presets[0].character)
    expect(guide).toContain(presets[0].axes[0])
  })

  it("asks for the decision and for the reason", () => {
    expect(guide).toContain("Pick one")
    expect(guide).toContain("note")
    expect(guide).toContain("ui-first")
  })
})

describe("a design travels in the file", () => {
  it("round-trips the note", () => {
    const source = serializeFlow({
      ...doc(),
      theme: { ...doc().theme, designNote: "A filing product, so it reads as a printed record" },
    })
    expect(source).toContain("note ")
    expect(parse(source).doc.theme.designNote).toBe(
      "A filing product, so it reads as a printed record"
    )
  })

  it("says which fields the file actually stated", () => {
    const stated = parse(`app "X"\n\ntheme { preset telegraph }\n\nscreen Home { layout auth-center }`)
    expect(stated.themeStated).toContain("preset")
    // Everything else in the block came back as a default, and a default is not
    // a statement — the distinction merging depends on.
    expect(stated.themeStated).not.toContain("vividness")
  })

  it("states nothing for a file with no theme block", () => {
    expect(parse(`app "X"\n\nscreen Home { layout auth-center }`).themeStated).toHaveLength(0)
  })

  it("warns about a preset it has never heard of, and names the real ones", () => {
    const result = parseFlow(`app "X"\n\ntheme { preset nordic-clean }\n\nscreen Home { layout auth-center }`)
    const warning = result.warnings.find((issue) => issue.message.includes("nordic-clean"))
    expect(warning).toBeDefined()
    expect(warning?.message).toContain("telegraph")
    // Kept as written rather than corrected: the file is the author's.
    expect(result.doc.theme.preset).toBe("nordic-clean")
  })
})

describe("merging brings the design with it", () => {
  const fragment = `app "X"

theme {
    preset telegraph
    note "A filing product, so it reads as a printed record"
}

screen reports "Reports" { layout auth-center }`

  it("applies what the file stated", () => {
    const project = doc()
    const parsed = parse(fragment)
    const report = mergeDoc(project, parsed.doc, parsed.themeStated)
    expect(project.theme.preset).toBe("telegraph")
    expect(project.theme.designNote).toContain("printed record")
    expect(report.themeFields).toBe(2)
    expect(report.preset).toBe("telegraph")
  })

  it("and the design actually resolves, rather than only being stored", () => {
    const project = doc()
    const parsed = parse(fragment)
    mergeDoc(project, parsed.doc, parsed.themeStated)
    expect(resolveTokens(project.theme).fonts.display).toBe("Roboto Slab")
  })

  it("leaves alone what the file never mentioned", () => {
    const project = { ...doc(), theme: { ...doc().theme, vividness: 12 } }
    const parsed = parse(fragment)
    mergeDoc(project, parsed.doc, parsed.themeStated)
    // Every absent line parses back as a default, so a merge that copied the
    // whole theme would silently undo tuning the file said nothing about.
    expect(project.theme.vividness).toBe(12)
  })

  it("changes no design at all when the file carries none", () => {
    const project = doc()
    const before = JSON.stringify(project.theme)
    const parsed = parse(`app "X"\n\nscreen reports "Reports" { layout auth-center }`)
    const report = mergeDoc(project, parsed.doc, parsed.themeStated)
    expect(JSON.stringify(project.theme)).toBe(before)
    expect(report.themeFields).toBe(0)
  })

  it("names the design in the report a person reads", () => {
    const project = doc()
    const parsed = parse(fragment)
    expect(describeMerge(mergeDoc(project, parsed.doc, parsed.themeStated))).toContain(
      "design: telegraph"
    )
  })
})

describe("the design can be copied on its own", () => {
  it("carries the stylesheet and the rules", () => {
    const prompt = buildDesignPrompt({
      ...doc(),
      theme: { ...doc().theme, preset: "telegraph", designNote: "Reads as a printed record" },
    })
    expect(prompt).toContain("Telegraph")
    expect(prompt).toContain("Reads as a printed record")
    expect(prompt).toContain("--background")
    expect(prompt).toContain("Do not ship any of these")
  })

  it("says nothing about the project it came from", () => {
    // The whole point: this is handed to something building a different thing.
    const source = doc()
    const prompt = buildDesignPrompt(source)
    expect(prompt).not.toContain(source.name)
    for (const screen of source.screens) {
      expect(prompt, `leaked the screen "${screen.title}"`).not.toContain(screen.title)
    }
    expect(prompt).not.toContain("folder")
    expect(prompt).not.toContain("Scope:")
  })

  it("says so plainly when the project asked for no design at all", () => {
    const basic = { ...doc(), theme: { ...doc().theme, designLanguage: "basic" } }
    expect(buildDesignPrompt(basic)).toContain("Basic")
  })
})
