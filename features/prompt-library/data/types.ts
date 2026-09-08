/**
 * A prompt in the library is not a prompt the app generates.
 *
 * Everything else in Prompt Studio composes a prompt out of a project — its
 * screens, its stack, its theme. These are the opposite: whole prompts written
 * by hand, complete on their own, meant to be copied into whatever assistant
 * somebody already has open. Nothing here reads `ProjectDoc`, and nothing here
 * needs a project to exist.
 */
export type PromptCategory = "Design" | "Build" | "Debug" | "Review" | "Plan"

export type LibraryPrompt = {
  id: string
  title: string
  /** One line, in the second person: what it gets you. */
  blurb: string
  category: PromptCategory
  /** Free-text labels for search. Lowercase. */
  tags: string[]
  /** What to change before sending, if anything. */
  howToUse: string
  /** The prompt itself, copied verbatim. */
  body: string
}
