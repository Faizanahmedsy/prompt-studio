/**
 * The design, on its own, with nothing of the project attached.
 *
 * The build prompt carries the design inside a brief about screens, stacks and
 * folder structure, which is right when you are asking for the app. It is
 * useless when you want to hand the *design* to something else — a page in
 * another repository, a component somebody is writing by hand, a second agent
 * that must match what this project already looks like. That reader does not
 * want the product described at it; it wants the stylesheet and the rules.
 *
 * So this is assembled from the same two blocks the build prompt uses rather
 * than from a second copy of them: the token file, and the craft rules. A
 * duplicate would drift, and the drift would be invisible — the two prompts
 * would agree about everything except the thing that changed.
 */

import { designBriefBlock } from "@/features/prompt/engine/design-brief"
import { tokensBlock } from "@/features/prompt/engine/tokens-block"
import { uiConventionsBlock } from "@/features/prompt/engine/ui-conventions"
import { presetById } from "@/features/theme/data/presets"
import type { ProjectDoc } from "@/types/project"

export function buildDesignPrompt(doc: ProjectDoc): string {
  // Nobody has chosen a design, so the reader is being asked to choose one.
  // The same brief the build prompt carries, with the product named — a design
  // decided without knowing who it is for is the failure this tool exists to
  // stop — and no screens, journeys or stack, which is what makes it a
  // separate button.
  if (doc.theme.designMode === "auto") {
    const roles = doc.views.map((view) => view.name.trim()).filter(Boolean)
    const brief = doc.requirements.split("\n").find((line) => line.trim())?.trim() ?? ""
    return [
      "## Design this",
      "",
      `**${doc.name || "This product"}**${brief ? ` — ${brief}` : ""}`,
      roles.length ? `Used by ${roles.join(", ")}.` : "",
      "",
      "No design has been chosen. You are choosing it — and what you hand back",
      "is the decision itself: the palette as named values, the two typefaces,",
      "the scale, the shape and depth rules, written as CSS custom properties,",
      "plus one screen rendered in it so the decision can be judged. Not an",
      "application.",
      "",
      "---",
      "",
      designBriefBlock(doc, "web", { intro: false }),
    ]
      .filter((line) => line !== "")
      .join("\n")
  }

  const preset = presetById(doc.theme.preset)
  const tokens = tokensBlock(doc)
  const craft = uiConventionsBlock(doc)

  // "basic" is the language that says not to design, and both blocks stand
  // down for it. Saying so is better than handing back an empty document.
  if (!tokens && !craft) {
    return [
      "## Design",
      "",
      "This project is set to **Basic**: no design direction, no token system.",
      "Use the framework's defaults and leave the styling to whoever adds a",
      "stylesheet later.",
    ].join("\n")
  }

  return [
    `## The design — ${preset.name}`,
    "",
    preset.character,
    "",
    ...(doc.theme.designNote.trim() ? [`> ${doc.theme.designNote.trim()}`, ""] : []),
    ...preset.axes.map((axis) => `- ${axis}`),
    "",
    "Everything below is the whole of it. There is no product brief here on",
    "purpose — apply this to whatever you are building.",
    "",
    "---",
    "",
    "## Design Tokens — write these first",
    "",
    tokens,
    "",
    "---",
    "",
    "## Interface craft",
    "",
    craft,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
}
