import { analyseGraph } from "@/features/builder/utils/graph"
import { describeLayout } from "@/features/library/data/layouts"
import { sectionTypeMap } from "@/features/library/data/section-types"
import { snippetMap } from "@/features/library/data/snippets"
import { screenTemplateMap } from "@/features/library/data/templates"
import { conventionMap } from "@/features/stack/data/conventions"
import {
  findStackOption,
  stackGroups,
  stackWarnings,
} from "@/features/stack/data/stack-catalogue"
import { structureMap } from "@/features/stack/data/structures"
import type { ProjectDoc } from "@/types/project"

import { type BlockId, getTarget } from "./targets"

export type PromptBlock = { id: BlockId; title: string; body: string }

export type BuiltPrompt = {
  text: string
  blocks: PromptBlock[]
  warnings: string[]
}

const radiusWords: Record<string, string> = {
  none: "square corners (0px)",
  small: "small radius (4px)",
  medium: "medium radius (8px)",
  large: "large radius (12px)",
  full: "fully rounded (pill) corners",
}

const buttonWords: Record<string, string> = {
  filled: "solid filled buttons",
  outlined: "outlined buttons with transparent fills",
  rounded: "soft, fully rounded buttons",
  sharp: "sharp-edged, high-contrast buttons",
}

const densityWords: Record<string, string> = {
  compact: "compact spacing — information dense, small paddings",
  comfortable: "comfortable spacing — the default rhythm",
  spacious: "spacious layout — generous whitespace, larger type",
}

function creativityLine(level: number) {
  if (level <= 2)
    return "Follow the layout specifications literally. Do not add sections, decoration or animation that is not described."
  if (level <= 4)
    return "Stay close to the specification. Small, tasteful refinements are welcome; the described structure stays intact."
  if (level <= 6)
    return "Balance the specification with sensible modern polish: subtle transitions, considered empty states, refined spacing."
  if (level <= 8)
    return "Interpret the specification confidently. Add motion, depth and micro-interactions where they aid comprehension, keeping the described structure."
  return "Treat the specification as direction rather than constraint. Push the visual design — bold type, layered depth, motion — while keeping every described screen and transition."
}

function list(lines: string[]) {
  return lines.map((line) => `- ${line}`).join("\n")
}

// ------------------------------------------------------------------ blocks

function overviewBlock(doc: ProjectDoc): string {
  const screens = doc.screens.length
  const sections = doc.sections.length
  const parts: string[] = []
  if (screens) {
    parts.push(
      `${screens} application screen${screens === 1 ? "" : "s"} connected by ${doc.edges.length} navigation transition${doc.edges.length === 1 ? "" : "s"}`
    )
  }
  if (sections) {
    parts.push(`a marketing page built from ${sections} sections`)
  }
  const scope = parts.length ? parts.join(", and ") : "the screens described below"
  return `Product: **${doc.name}**\n\nScope: ${scope}.\n\nThis brief is complete: implement every screen and every transition listed. Where something is unspecified, choose the option most consistent with the conventions below rather than inventing new patterns.`
}

function screensBlock(doc: ProjectDoc): string {
  if (!doc.screens.length) return ""
  const { ordered } = analyseGraph(doc.screens, doc.edges)
  return ordered
    .map((screen, index) => {
      const template = screenTemplateMap[screen.template]
      const layout = describeLayout(screen.layout)
      const lines = [
        `${index + 1}. **${screen.title}** \`${screen.key}\`${template ? ` — ${template.name}` : ""}`,
      ]
      if (template) lines.push(`   Purpose: ${template.promptDetails}.`)
      lines.push(`   Layout: ${layout.name} — ${layout.promptDetails}`)
      if (screen.note.trim()) lines.push(`   Notes: ${screen.note.trim()}`)
      return lines.join("\n")
    })
    .join("\n\n")
}

function navigationBlock(doc: ProjectDoc): string {
  if (!doc.screens.length) return ""
  const { ordered, entries, branching } = analyseGraph(doc.screens, doc.edges)
  const byId = new Map(doc.screens.map((s) => [s.id, s]))
  const lines: string[] = []

  if (entries.length) {
    lines.push(
      `Entry point${entries.length === 1 ? "" : "s"}: ${entries.map((s) => `**${s.title}**`).join(", ")}.`
    )
  }
  if (ordered.length > 1) {
    lines.push("")
    lines.push(`Flow: ${ordered.map((s) => s.title).join(" → ")}`)
  }

  if (doc.edges.length) {
    lines.push("")
    lines.push("Transitions:")
    lines.push(
      list(
        doc.edges
          .map((edge) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (!from || !to) return ""
            const trigger = edge.trigger.trim()
            return `From **${from.title}** to **${to.title}**${trigger ? ` — ${trigger}` : ""}.`
          })
          .filter(Boolean)
      )
    )
  }

  if (branching.length) {
    lines.push("")
    lines.push(
      `Branch points (more than one outgoing path — make the choice explicit in the UI): ${branching
        .map((s) => s.title)
        .join(", ")}.`
    )
  }

  lines.push("")
  lines.push(
    "Navigation must be real: every transition above is a working link or action, and the user can always get back."
  )
  return lines.join("\n")
}

function sectionsBlock(doc: ProjectDoc): string {
  if (!doc.sections.length) return ""
  const ordered = [...doc.sections].sort((a, b) => a.order - b.order)
  const body = ordered
    .map((section, index) => {
      const type = sectionTypeMap[section.type]
      const layout = describeLayout(section.layout)
      const lines = [
        `${index + 1}. **${section.name || type?.name || section.type}**${type ? ` (${type.name})` : ""}`,
      ]
      if (type) lines.push(`   Purpose: ${type.promptDetails}.`)
      lines.push(`   Layout: ${layout.name} — ${layout.promptDetails}`)
      if (section.note.trim()) lines.push(`   Notes: ${section.note.trim()}`)
      return lines.join("\n")
    })
    .join("\n\n")
  return `${body}\n\nRender the sections in exactly this order, each as its own full-width band with consistent vertical rhythm.`
}

function designBlock(doc: ProjectDoc): string {
  const t = doc.theme
  return [
    list([
      `Primary colour: ${t.primaryColor} — used for primary actions, active states and focus rings.`,
      `Secondary / accent colour: ${t.secondaryColor} — supporting highlights and charts.`,
      `Corners: ${radiusWords[t.borderRadius] ?? t.borderRadius}.`,
      `Buttons: ${buttonWords[t.buttonStyle] ?? t.buttonStyle}.`,
      `Density: ${densityWords[t.density] ?? t.density}.`,
      "Define every colour once as CSS custom properties for light and dark themes; components reference the tokens, never raw hex values.",
    ]),
    "",
    `Creative latitude (${doc.creativity}/10): ${creativityLine(doc.creativity)}`,
  ].join("\n")
}

function stackBlock(doc: ProjectDoc, detail: "full" | "condensed"): string {
  const lines: string[] = []
  for (const group of stackGroups) {
    const value = doc.stack[group.key]
    const option = findStackOption(group.key, value)
    if (!option) {
      if (value) lines.push(`${group.label}: ${value}`)
      continue
    }
    if (detail === "condensed" && ["tooling", "packageManager", "testing"].includes(group.key)) {
      continue
    }
    lines.push(option.promptLine)
  }
  for (const extra of doc.stack.extras) {
    if (extra.trim()) lines.push(extra.trim())
  }
  return list(lines)
}

function structureBlock(doc: ProjectDoc): string {
  const preset = structureMap[doc.structure.preset]
  const tree =
    doc.structure.preset === "custom" || !preset?.tree
      ? doc.structure.customTree.trim()
      : preset.tree
  if (!tree) return ""
  const notes = preset?.notes?.length ? `\n\n${list(preset.notes)}` : ""
  return `Use this folder structure:\n\n\`\`\`\n${tree}\n\`\`\`${notes}`
}

function conventionsBlock(doc: ProjectDoc): string {
  const lines = doc.conventions.ids
    .map((id) => conventionMap[id]?.line ?? id)
    .filter(Boolean)
  const custom = doc.conventions.custom.trim()
  if (!lines.length && !custom) return ""
  return [list(lines), custom ? `\n${custom}` : ""].filter(Boolean).join("\n")
}

const baseRequirements = [
  "Fully responsive from 360px to wide desktop — mobile-first, no horizontal page scroll at any width.",
  "Every screen handles its loading, empty and error states explicitly.",
  "Keyboard accessible with visible focus, labelled controls and WCAG AA contrast.",
  "Consistent navigation, spacing and typography across every screen.",
]

function requirementsBlock(doc: ProjectDoc): string {
  const lines = [...baseRequirements]
  for (const id of doc.snippetIds) {
    const snippet = snippetMap[id]
    if (snippet) lines.push(...snippet.lines)
  }
  return list(Array.from(new Set(lines)))
}

function additionalBlock(doc: ProjectDoc): string {
  return doc.requirements.trim()
}

function deliveryBlock(doc: ProjectDoc): string {
  const count = doc.screens.length
  return list(
    [
      count
        ? `Deliver all ${count} screen${count === 1 ? "" : "s"} — a screen that only renders a title is not delivered.`
        : "Deliver the full page, section by section.",
      "No placeholder text, TODO comments or stubbed handlers.",
      "State any assumption you had to make at the end of your response, in one short list.",
    ].filter(Boolean)
  )
}

const titles: Record<BlockId, string> = {
  overview: "Overview",
  screens: "Screens",
  navigation: "Navigation & Flow",
  sections: "Page Sections",
  design: "Design System",
  stack: "Tech Stack",
  structure: "Project Structure",
  conventions: "Conventions",
  requirements: "Technical Requirements",
  additional: "Additional Requirements",
  delivery: "Definition of Done",
}

// ------------------------------------------------------------------- build

export function buildPrompt(doc: ProjectDoc): BuiltPrompt {
  const target = getTarget(doc.target)
  const bodies: Record<BlockId, string> = {
    overview: overviewBlock(doc),
    screens: screensBlock(doc),
    navigation: navigationBlock(doc),
    sections: sectionsBlock(doc),
    design: designBlock(doc),
    stack: stackBlock(doc, target.stackDetail),
    structure: structureBlock(doc),
    conventions: conventionsBlock(doc),
    requirements: requirementsBlock(doc),
    additional: additionalBlock(doc),
    delivery: deliveryBlock(doc),
  }

  const blocks: PromptBlock[] = target.order
    .filter((id) => bodies[id].trim().length > 0)
    .map((id) => ({ id, title: titles[id], body: bodies[id].trim() }))

  const rendered = blocks
    .map((block) =>
      target.format === "xml"
        ? `<${xmlTag(block.id)}>\n${block.body}\n</${xmlTag(block.id)}>`
        : `## ${block.title}\n\n${block.body}`
    )
    .join("\n\n")

  const text = [target.preamble(doc.name), rendered, target.closing]
    .filter(Boolean)
    .join("\n\n")

  return { text, blocks, warnings: collectWarnings(doc) }
}

function xmlTag(id: BlockId) {
  return id.replace(/[^a-z]/g, "_")
}

export function collectWarnings(doc: ProjectDoc): string[] {
  const warnings: string[] = []
  if (!doc.screens.length && !doc.sections.length) {
    warnings.push("Nothing to build yet — add a screen or a page section.")
  }

  const { unreachable, cycles, danglingEdges } = analyseGraph(doc.screens, doc.edges)
  for (const screen of unreachable) {
    warnings.push(`"${screen.title}" is not connected to any other screen.`)
  }
  if (doc.screens.length > 1 && !doc.edges.length) {
    warnings.push(
      "No connections yet — connect the screens so the generated prompt can describe the flow."
    )
  }
  for (const cycle of cycles) {
    const names = cycle
      .map((id) => doc.screens.find((s) => s.id === id)?.title ?? id)
      .join(" → ")
    warnings.push(`Loop detected: ${names} → …. Fine if intentional (e.g. save and return).`)
  }
  if (danglingEdges.length) {
    warnings.push(`${danglingEdges.length} connection(s) point at a deleted screen.`)
  }

  const missingLayout = doc.screens.filter((s) => !s.layout).length
  if (missingLayout) {
    warnings.push(
      `${missingLayout} screen(s) have no layout chosen — the prompt will fall back to a generic description.`
    )
  }
  const missingTemplate = doc.screens.filter((s) => !s.template).length
  if (missingTemplate) {
    warnings.push(`${missingTemplate} screen(s) have no type chosen.`)
  }
  const missingSectionLayout = doc.sections.filter((s) => !s.layout).length
  if (missingSectionLayout) {
    warnings.push(`${missingSectionLayout} section(s) have no layout chosen.`)
  }

  warnings.push(...stackWarnings(doc.stack))

  if (doc.structure.preset === "custom" && !doc.structure.customTree.trim()) {
    warnings.push("Custom folder structure selected but no tree pasted in.")
  }
  return warnings
}
