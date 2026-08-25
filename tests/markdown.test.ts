import { describe, expect, it } from "vitest"
import { starterDoc } from "@/features/library/data/starters"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { parseInline, parseMarkdown } from "@/features/prompt/markdown/parse"
import { projectDocSchema } from "@/types/project"

/**
 * The parser only has to handle the Markdown this app *writes*, so the last
 * test here is the one that matters: every block of a real generated prompt,
 * parsed, with nothing lost.
 */

describe("inline spans", () => {
  it("reads bold, italic, code and links", () => {
    expect(parseInline("plain **bold** *italic* `code` [text](https://x.com)")).toEqual([
      { type: "text", value: "plain " },
      { type: "bold", value: "bold" },
      { type: "text", value: " " },
      { type: "italic", value: "italic" },
      { type: "text", value: " " },
      { type: "code", value: "code" },
      { type: "text", value: " " },
      { type: "link", value: "text", href: "https://x.com" },
    ])
  })

  it("treats a backtick span as literal", () => {
    // The whole point of code formatting: `**not bold**` must survive intact,
    // which it only does because the code rule runs before the bold one.
    expect(parseInline("use `**kwargs` here")).toEqual([
      { type: "text", value: "use " },
      { type: "code", value: "**kwargs" },
      { type: "text", value: " here" },
    ])
  })

  it("leaves lone asterisks alone", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ type: "text", value: "2 * 3 = 6" }])
  })
})

describe("blocks", () => {
  it("reads headings at every level it supports", () => {
    const blocks = parseMarkdown("# One\n## Two\n### Three\n#### Four\n##### Five")
    expect(blocks.map((b) => (b.type === "heading" ? b.level : b.type))).toEqual([
      1, 2, 3, 4, 4,
    ])
  })

  it("keeps a fenced block exactly as written", () => {
    const source = "text\n\n```flow\nscreen a {\n  # not a heading\n}\n\n- not a bullet\n```\n\nafter"
    const blocks = parseMarkdown(source)
    const code = blocks.find((b) => b.type === "code")
    expect(code).toEqual({
      type: "code",
      language: "flow",
      value: "screen a {\n  # not a heading\n}\n\n- not a bullet",
    })
    expect(blocks.filter((b) => b.type === "paragraph")).toHaveLength(2)
  })

  it("gathers bullets into one list", () => {
    const blocks = parseMarkdown("- one\n- two\n* three")
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type === "bullets" && blocks[0].items).toHaveLength(3)
  })

  it("keeps a numbered list's starting number", () => {
    const blocks = parseMarkdown("3. third\n4. fourth")
    expect(blocks[0]).toMatchObject({ type: "numbers", start: 3 })
  })

  it("folds a hanging continuation into the item above it", () => {
    // The prompt generator indents wrapped rules like this constantly; treated
    // as a new paragraph they would break the list in half.
    const blocks = parseMarkdown("1. First rule\n   and its second line\n2. Second rule")
    expect(blocks).toHaveLength(1)
    const items = blocks[0].type === "numbers" ? blocks[0].items : []
    expect(items).toHaveLength(2)
    expect(items[0].map((span) => span.value).join("")).toBe("First rule and its second line")
  })

  it("needs a divider row before it calls something a table", () => {
    const real = parseMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |")
    expect(real[0]).toMatchObject({ type: "table" })

    const prose = parseMarkdown("choose a | b | c and move on")
    expect(prose[0].type).toBe("paragraph")
  })

  it("reads quotes and rules", () => {
    const blocks = parseMarkdown("> quoted\n> still quoted\n\n---\n\nafter")
    expect(blocks.map((b) => b.type)).toEqual(["quote", "rule", "paragraph"])
  })

  it("survives an unterminated fence without losing the rest", () => {
    const blocks = parseMarkdown("before\n\n```\nnever closed")
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "code"])
  })

  it("returns nothing for empty input", () => {
    expect(parseMarkdown("")).toEqual([])
    expect(parseMarkdown("\n\n  \n")).toEqual([])
  })
})

describe("a real generated prompt", () => {
  it("parses every block, and loses no fenced source", () => {
    const doc = projectDocSchema.parse(starterDoc("admin-crud"))
    const built = buildPrompt(doc)
    expect(built.blocks.length).toBeGreaterThan(0)

    for (const block of built.blocks) {
      const parsed = parseMarkdown(block.body)
      if (!block.body.trim()) continue
      expect(parsed.length, `nothing parsed from “${block.title}”`).toBeGreaterThan(0)

      // Every fenced block in the source has to come out the other side, or the
      // rendered view is quietly dropping the part people care most about.
      const fences = (block.body.match(/^\s*```/gm) ?? []).length
      const parsedCode = parsed.filter((entry) => entry.type === "code").length
      expect(parsedCode, `fences lost in “${block.title}”`).toBe(Math.floor(fences / 2))
    }
  })

  it("never produces an empty text span run for a non-empty line", () => {
    const doc = projectDocSchema.parse(starterDoc("saas-dashboard"))
    for (const block of buildPrompt(doc).blocks) {
      for (const entry of parseMarkdown(block.body)) {
        if (entry.type === "paragraph") {
          expect(entry.content.map((span) => span.value).join("").trim()).not.toBe("")
        }
      }
    }
  })
})
