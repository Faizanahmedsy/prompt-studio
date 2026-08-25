/**
 * A small Markdown parser for the text this app generates.
 *
 * Not a general one, and deliberately so. The input is our own prompt output —
 * `build-prompt.ts` writes it — so the grammar it has to cover is known and
 * closed: headings, bullets, numbered items with hanging continuation lines,
 * fenced code, tables, blockquotes, horizontal rules, and inline bold / italic
 * / code / links. Pulling in a full CommonMark implementation would add a
 * dependency and a bundle for constructs nothing here emits.
 *
 * It is a pure function over a string, which is the point: the rendering is a
 * dumb walk over this, and every edge case is testable without a DOM.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string }

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "bullets"; items: Inline[][] }
  | { type: "numbers"; items: Inline[][]; start: number }
  | { type: "code"; language: string; value: string }
  | { type: "quote"; content: Inline[] }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] }
  | { type: "rule" }

// Up to six, clamped to four when rendering: nothing here needs an <h5>,
// and a `##### heading` silently becoming a paragraph is worse than one
// that renders slightly larger than intended.
const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/
const FENCE = /^\s*```(\S*)\s*$/
const QUOTE = /^\s*>\s?(.*)$/
const RULE = /^\s*(?:---+|\*\*\*+|___+)\s*$/
const TABLE_DIVIDER = /^\s*\|?[\s:|-]+\|[\s:|-]*$/

/**
 * Inline spans, resolved in one pass.
 *
 * Code first, and it wins: a backtick span is literal, so `**not bold**` inside
 * one has to survive intact. Doing bold first would eat the asterisks before
 * the code rule ever saw them.
 */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g

  let index = 0
  for (const match of source.matchAll(pattern)) {
    if (match.index > index) {
      out.push({ type: "text", value: source.slice(index, match.index) })
    }
    const token = match[0]
    if (token.startsWith("`")) {
      out.push({ type: "code", value: token.slice(1, -1) })
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push({ type: "bold", value: token.slice(2, -2) })
    } else if (token.startsWith("*")) {
      out.push({ type: "italic", value: token.slice(1, -1) })
    } else {
      const split = token.indexOf("](")
      out.push({
        type: "link",
        value: token.slice(1, split),
        href: token.slice(split + 2, -1),
      })
    }
    index = match.index + token.length
  }
  if (index < source.length) out.push({ type: "text", value: source.slice(index) })
  return out.length ? out : [{ type: "text", value: "" }]
}

function cells(row: string): string[] {
  return row
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let index = 0

  const flushParagraph = (buffer: string[]) => {
    if (!buffer.length) return
    blocks.push({ type: "paragraph", content: parseInline(buffer.join(" ")) })
    buffer.length = 0
  }

  const paragraph: string[] = []

  while (index < lines.length) {
    const line = lines[index]

    // Fenced code. Everything inside is taken literally, including blank lines
    // and anything that would otherwise look like a heading or a bullet.
    const fence = FENCE.exec(line)
    if (fence) {
      flushParagraph(paragraph)
      const language = fence[1] ?? ""
      const body: string[] = []
      index += 1
      while (index < lines.length && !FENCE.test(lines[index])) {
        body.push(lines[index])
        index += 1
      }
      index += 1 // the closing fence, or the end of the input
      blocks.push({ type: "code", language, value: body.join("\n") })
      continue
    }

    if (!line.trim()) {
      flushParagraph(paragraph)
      index += 1
      continue
    }

    if (RULE.test(line)) {
      flushParagraph(paragraph)
      blocks.push({ type: "rule" })
      index += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      flushParagraph(paragraph)
      blocks.push({
        type: "heading",
        level: Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4,
        content: parseInline(heading[2]),
      })
      index += 1
      continue
    }

    // A table needs its divider row to be a table at all; without it the
    // pipes are just characters in a sentence.
    if (line.includes("|") && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
      flushParagraph(paragraph)
      const head = cells(line).map(parseInline)
      index += 2
      const rows: Inline[][][] = []
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(cells(lines[index]).map(parseInline))
        index += 1
      }
      blocks.push({ type: "table", head, rows })
      continue
    }

    if (QUOTE.test(line)) {
      flushParagraph(paragraph)
      const body: string[] = []
      while (index < lines.length && QUOTE.test(lines[index])) {
        body.push(QUOTE.exec(lines[index])![1])
        index += 1
      }
      blocks.push({ type: "quote", content: parseInline(body.join(" ")) })
      continue
    }

    if (BULLET.test(line) || NUMBER.test(line)) {
      flushParagraph(paragraph)
      const numbered = NUMBER.test(line)
      const start = numbered ? Number(NUMBER.exec(line)![1]) : 1
      const items: string[] = []

      while (index < lines.length) {
        const bullet = BULLET.exec(lines[index])
        const number = NUMBER.exec(lines[index])
        if (numbered ? number : bullet) {
          items.push((numbered ? number![2] : bullet![1]) as string)
          index += 1
          continue
        }
        // A hanging continuation — an indented line under an item, which the
        // prompt generator emits a lot of. It belongs to the item above, not to
        // a new paragraph.
        if (items.length && /^\s{2,}\S/.test(lines[index]) && !FENCE.test(lines[index])) {
          items[items.length - 1] += ` ${lines[index].trim()}`
          index += 1
          continue
        }
        break
      }

      blocks.push(
        numbered
          ? { type: "numbers", items: items.map(parseInline), start }
          : { type: "bullets", items: items.map(parseInline) }
      )
      continue
    }

    paragraph.push(line.trim())
    index += 1
  }

  flushParagraph(paragraph)
  return blocks
}
