"use client"

/**
 * The prompt library.
 *
 * Every other view in this app *composes* a prompt out of a project. This one
 * hands over prompts that were written by hand and are complete without one —
 * you copy them into whatever assistant you already have open. It therefore
 * takes no project and writes nothing: the whole page is a reader.
 *
 * Master and detail rather than a wall of cards. These prompts are long — the
 * design ones run to several screens — so a grid of previews would show the
 * first two lines of each and hide the part that decides whether it is the one
 * you want.
 */

import { Check, Copy, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  type LibraryPrompt,
  libraryPrompts,
  type PromptCategory,
  promptCategories,
  searchPrompts,
} from "@/features/prompt-library/data/prompts"
import { cn } from "@/lib/utils"

const CATEGORY_HINT: Record<PromptCategory, string> = {
  Design: "How it should look, and why that look and not another",
  Build: "Writing the thing, and keeping it working while you change it",
  Debug: "Finding the cause instead of guessing at fixes",
  Review: "Reading somebody's change, including your own",
  Plan: "Deciding what to build before anyone builds it",
}

export function PromptLibrary() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<PromptCategory | null>(null)
  const [selectedId, setSelectedId] = useState(libraryPrompts[0].id)
  const [copied, setCopied] = useState<string | null>(null)

  const results = useMemo(() => {
    const byCategory = category
      ? libraryPrompts.filter((p) => p.category === category)
      : libraryPrompts
    return searchPrompts(byCategory, query)
  }, [category, query])

  // The selection survives filtering when it can, so typing into the search
  // box does not throw away what you were reading. When it cannot, the first
  // result takes over rather than leaving the pane empty.
  const selected =
    results.find((p) => p.id === selectedId) ?? results[0] ?? null

  async function copy(prompt: LibraryPrompt) {
    try {
      await navigator.clipboard.writeText(prompt.body)
      setCopied(prompt.id)
      toast.success("Copied — paste it into your assistant")
      setTimeout(() => setCopied((id) => (id === prompt.id ? null : id)), 1600)
    } catch {
      toast.error("Could not reach the clipboard. Select the text and copy it.")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* ------------------------------------------------------------ list */}
      <aside className="flex min-h-0 shrink-0 flex-col border-b border-border bg-card lg:w-[22rem] lg:border-r lg:border-b-0">
        <div className="shrink-0 space-y-3 border-b border-border p-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              Prompt library
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Whole prompts, ready to paste into Claude, ChatGPT, Cursor or
              anything else. Nothing here needs a project.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prompts"
              aria-label="Search prompts"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            <CategoryChip
              active={category === null}
              onClick={() => setCategory(null)}
              label="All"
              hint="Every prompt in the library"
            />
            {promptCategories.map((name) => (
              <CategoryChip
                key={name}
                active={category === name}
                onClick={() => setCategory(category === name ? null : name)}
                label={name}
                hint={CATEGORY_HINT[name]}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((prompt) => (
                <li key={prompt.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(prompt.id)}
                    aria-current={selected?.id === prompt.id}
                    className={cn(
                      "w-full rounded-md border border-transparent px-3 py-2.5 text-left transition-colors",
                      selected?.id === prompt.id
                        ? "border-border bg-muted"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {prompt.title}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {prompt.category}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {prompt.blurb}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ---------------------------------------------------------- detail */}
      <section className="min-h-0 flex-1 overflow-y-auto">
        {selected ? (
          <article className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
            <header className="border-b border-border pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="soft">{selected.category}</Badge>
                {selected.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                {selected.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {selected.blurb}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {/* The top bar carries a "Copy prompt" of its own — the one
                    that builds from this project — so this button spells out
                    which prompt it means for anyone who cannot see which pane
                    it sits in. */}
                <Button
                  aria-label={`Copy the ${selected.title} prompt`}
                  onClick={() => void copy(selected)}
                >
                  {copied === selected.id ? <Check /> : <Copy />}
                  {copied === selected.id ? "Copied" : "Copy this prompt"}
                </Button>
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                  {selected.howToUse}
                </p>
              </div>
            </header>

            <PromptBody body={selected.body} />
          </article>
        ) : null}
      </section>
    </div>
  )
}

function CategoryChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

/**
 * The prompt, rendered rather than dumped into a textarea.
 *
 * These are markdown-ish — headings, bullets, bold, and a bracketed slot where
 * you fill in your own product. Shown raw they read as a wall; shown rendered
 * you can see the shape of the instructions before deciding to copy them. The
 * copy button always sends the raw text, so what you paste is what is written
 * here and not what is drawn.
 */
function PromptBody({ body }: { body: string }) {
  const blocks = useMemo(() => body.split("\n"), [body])

  return (
    <div className="mt-6 space-y-3 text-sm leading-relaxed">
      {blocks.map((line, index) => {
        const key = `${index}-${line.slice(0, 12)}`
        if (!line.trim()) return <div key={key} className="h-1" />

        // Two levels. The master brief is long enough to need both: `#` for
        // its parts and `##` for the rules inside them.
        if (line.startsWith("# ")) {
          return (
            <h3
              key={key}
              className="border-b border-border pt-8 pb-2 text-base font-semibold tracking-tight text-foreground"
            >
              {line.slice(2)}
            </h3>
          )
        }

        if (line.startsWith("## ")) {
          return (
            <h4
              key={key}
              className="pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {line.slice(3)}
            </h4>
          )
        }

        if (line.trim() === "---") {
          return <hr key={key} className="my-6 border-border" />
        }

        // A bracketed line on its own is the slot you replace.
        if (/^\[.*\]$/.test(line.trim())) {
          return (
            <p
              key={key}
              className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground"
            >
              {line.trim()}
            </p>
          )
        }

        const bullet = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
        if (bullet) {
          const [, indent, marker, text] = bullet
          return (
            <p
              key={key}
              className={cn(
                "flex gap-2 text-muted-foreground",
                indent.length > 0 && "pl-5"
              )}
            >
              <span className="shrink-0 text-foreground/40">{marker}</span>
              <span>{emphasise(text)}</span>
            </p>
          )
        }

        return (
          <p key={key} className="text-muted-foreground">
            {emphasise(line)}
          </p>
        )
      })}
    </div>
  )
}

/**
 * `**bold**` and `*italic*`, the two inline marks these prompts use.
 *
 * One pass over both rather than bold first and italic after: splitting on
 * `*` after the bold pass would find the halves of every `**` it had already
 * consumed, and the page would fill with stray asterisks.
 */
function emphasise(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={index} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <span key={index}>{part}</span>
  })
}
