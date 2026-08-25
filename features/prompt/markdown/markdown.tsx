"use client"

import { type Block, type Inline, parseMarkdown } from "@/features/prompt/markdown/parse"
import { cn } from "@/lib/utils"

/**
 * Renders the prompt as prose instead of a wall of monospace.
 *
 * The prompt is written in Markdown — headings, numbered rules, fenced Flow
 * source — and reading it as raw text is exactly as hard as it sounds. This is
 * for the review-and-handover case: someone who has to *read* the prompt, on
 * paper or on a screen, rather than paste it.
 *
 * There is no `dangerouslySetInnerHTML` anywhere here. Everything is real
 * elements built from the parsed tree, so a project note containing `<script>`
 * is text, the way it would be in any other part of the app.
 */

function Spans({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((span, index) => {
        const key = `${span.type}-${index}`
        if (span.type === "bold") return <strong key={key}>{span.value}</strong>
        if (span.type === "italic") return <em key={key}>{span.value}</em>
        if (span.type === "code")
          return (
            <code
              key={key}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground"
            >
              {span.value}
            </code>
          )
        if (span.type === "link")
          return (
            <a
              key={key}
              href={span.href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {span.value}
            </a>
          )
        return <span key={key}>{span.value}</span>
      })}
    </>
  )
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-6 mb-3 text-xl font-semibold tracking-tight",
  2: "mt-6 mb-2.5 text-lg font-semibold tracking-tight",
  3: "mt-5 mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground",
  4: "mt-4 mb-1.5 text-sm font-semibold",
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const Tag = (["h1", "h2", "h3", "h4"] as const)[block.level - 1]
      return (
        <Tag className={cn("break-after-avoid", HEADING_CLASS[block.level])}>
          <Spans content={block.content} />
        </Tag>
      )
    }
    case "paragraph":
      return (
        <p className="my-2 text-[13px] leading-relaxed">
          <Spans content={block.content} />
        </p>
      )
    case "bullets":
      return (
        <ul className="my-2 ml-5 list-disc space-y-1 text-[13px] leading-relaxed marker:text-muted-foreground">
          {block.items.map((item, index) => (
            <li key={index}>
              <Spans content={item} />
            </li>
          ))}
        </ul>
      )
    case "numbers":
      return (
        <ol
          start={block.start}
          className="my-2 ml-5 list-decimal space-y-1 text-[13px] leading-relaxed marker:text-muted-foreground"
        >
          {block.items.map((item, index) => (
            <li key={index}>
              <Spans content={item} />
            </li>
          ))}
        </ol>
      )
    case "code":
      return (
        <pre className="code-surface my-3 overflow-x-auto break-inside-avoid text-[11.5px] leading-relaxed">
          <code>{block.value}</code>
        </pre>
      )
    case "quote":
      return (
        <blockquote className="my-3 border-l-2 border-primary/40 pl-3 text-[13px] italic leading-relaxed text-muted-foreground">
          <Spans content={block.content} />
        </blockquote>
      )
    case "table":
      return (
        // The wrapper scrolls, not the page. A wide table must never make the
        // whole document scroll sideways.
        <div className="my-3 overflow-x-auto break-inside-avoid">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border">
                {block.head.map((cell, index) => (
                  <th key={index} className="px-2 py-1.5 text-left font-semibold">
                    <Spans content={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/60">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-2 py-1.5 align-top">
                      <Spans content={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "rule":
      return <hr className="my-5 border-border" />
  }
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className={cn("prompt-markdown", className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  )
}
