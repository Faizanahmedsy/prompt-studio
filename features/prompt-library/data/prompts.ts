import { designPrompts } from "./design-prompts"
import type { LibraryPrompt, PromptCategory } from "./types"
import { workPrompts } from "./work-prompts"

export type { LibraryPrompt, PromptCategory } from "./types"

/**
 * The library, in the order it is shown.
 *
 * Design first, deliberately: it is the reason the page exists, and the one
 * category whose prompts came out of a real test rather than out of judgement.
 */
export const libraryPrompts: LibraryPrompt[] = [...designPrompts, ...workPrompts]

/** Category order for the filter, not alphabetical. */
export const promptCategories: PromptCategory[] = [
  "Design",
  "Build",
  "Debug",
  "Review",
  "Plan",
]

export const promptById = new Map(libraryPrompts.map((p) => [p.id, p]))

/**
 * Search across everything a person might remember about a prompt — its name,
 * what it does, how to use it, and the body itself. Searching only the title
 * would mean knowing what we called it, which nobody does on the second visit.
 */
export function searchPrompts(
  prompts: LibraryPrompt[],
  query: string
): LibraryPrompt[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return prompts
  const words = needle.split(/\s+/)
  return prompts.filter((prompt) => {
    const haystack = [
      prompt.title,
      prompt.blurb,
      prompt.category,
      prompt.howToUse,
      prompt.tags.join(" "),
      prompt.body,
    ]
      .join(" ")
      .toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
