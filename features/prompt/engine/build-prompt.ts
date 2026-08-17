import { analyseGraph } from "@/features/builder/utils/graph"
import {
  stackFor,
  structureFor,
  surfaceMeta,
} from "@/features/builder/utils/surfaces"
import { edgesInView, screensInView, viewNames } from "@/features/builder/utils/views"
import { describeLayout } from "@/features/library/data/layouts"
import { describeModuleKind } from "@/features/library/data/module-kinds"
import { sectionTypeMap } from "@/features/library/data/section-types"
import { snippetMap } from "@/features/library/data/snippets"
import { screenTemplateMap } from "@/features/library/data/templates"
import { conventionMap } from "@/features/stack/data/conventions"
import {
  findStackOption,
  stackGroups,
  stackWarnings,
} from "@/features/stack/data/stack-catalogue"
import {
  conventionOverrides,
  platformDelivery,
  platformOf,
  platformRequirements,
  webOnlyConventionIds,
} from "@/features/stack/data/platforms"
import { structureMap } from "@/features/stack/data/structures"
import { describeDesignLanguage } from "@/features/theme/data/design-languages"
import type { ProjectDoc, Surface } from "@/types/project"

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

/**
 * Terminates a fragment so two of them can sit on one line. Module lines are
 * assembled from a catalogue sentence, a trigger and a free-text note, and
 * without this they ran together into "…survives a reload Appears/fires: …".
 */
function sentence(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return ""
  return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`
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
  if (doc.modules.length) {
    parts.push(
      `${doc.modules.length} module${doc.modules.length === 1 ? "" : "s"} inside those screens`
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
      if (doc.views.length) {
        const names = viewNames(doc, screen.views)
        lines.push(
          `   Visible to: ${names.length ? names.join(", ") : "every role"}.`
        )
      }
      lines.push(...modulesOfScreen(doc, screen.id))
      return lines.join("\n")
    })
    .join("\n\n")
}

/**
 * The inside of one screen. Most of a real application's behaviour lives here
 * rather than between screens, so where modules exist they carry more weight
 * than the screen line above them. Emitted only when the screen has any, which
 * is what keeps the output byte-identical for module-free projects.
 */
function modulesOfScreen(doc: ProjectDoc, screenId: string): string[] {
  const modules = doc.modules
    .filter((m) => m.screenId === screenId)
    .sort((a, b) => a.order - b.order)
  if (!modules.length) return []

  const lines = ["   Modules on this screen:"]
  for (const module of modules) {
    const kind = describeModuleKind(module.kind)
    const parts = [
      `   - **${module.name}** (${kind.name}) — ${sentence(kind.promptDetails)}`,
    ]
    if (module.trigger.trim()) {
      parts.push(sentence(`Appears/fires: ${module.trigger.trim()}`))
    }
    if (module.note.trim()) parts.push(sentence(module.note.trim()))
    lines.push(parts.join(" "))
  }

  const byId = new Map(modules.map((m) => [m.id, m]))
  const inner = doc.moduleEdges.filter(
    (e) => byId.has(e.from) && byId.has(e.to)
  )
  if (inner.length) {
    lines.push("   Inside this screen:")
    for (const edge of inner) {
      const from = byId.get(edge.from)!
      const to = byId.get(edge.to)!
      const trigger = edge.trigger.trim()
      lines.push(
        `   - **${from.name}** → **${to.name}**${trigger ? ` — ${trigger}` : ""}.`
      )
    }
  }
  return lines
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

/**
 * One app, several audiences. The build agent needs the whole picture in one
 * pass — it is implementing one route table with role gates, not N apps — so
 * every screen is described once above and this block says who reaches what.
 */
function viewsBlock(doc: ProjectDoc): string {
  if (!doc.views.length || !doc.screens.length) return ""

  const parts: string[] = [
    `This product is used by ${doc.views.length} different kinds of user. Every screen above exists once; access is what differs. Gate routes and navigation by role, and never rely on hiding a link alone — a role that cannot use a screen must not be able to reach it by typing the URL.`,
    "",
  ]

  for (const view of doc.views) {
    const screens = screensInView(doc, view.id)
    const edges = edgesInView(doc, view.id)
    const { ordered, entries } = analyseGraph(screens, edges)
    const exclusive = screens.filter((s) => s.views.includes(view.id))

    parts.push(`### ${view.name}`)
    if (view.note.trim()) parts.push(view.note.trim())
    parts.push(
      `Reaches ${screens.length} of ${doc.screens.length} screens${
        entries.length
          ? `, starting at ${entries.map((s) => `**${s.title}**`).join(" or ")}`
          : ""
      }.`
    )
    if (ordered.length > 1) {
      parts.push(`Path: ${ordered.map((s) => s.title).join(" → ")}`)
    }
    if (exclusive.length) {
      parts.push(
        `Only this role sees: ${exclusive.map((s) => `**${s.title}**`).join(", ")}.`
      )
    }
    parts.push("")
  }

  const shared = doc.screens.filter((s) => s.views.length === 0)
  if (shared.length) {
    parts.push(
      `Shared by every role: ${shared.map((s) => `**${s.title}**`).join(", ")}. Build these once and reuse them; do not fork a copy per role.`
    )
  }

  return parts.join("\n")
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
  const language = describeDesignLanguage(t.designLanguage)
  return [
    `Design language — **${language.name}**: ${language.promptDetails}`,
    "",
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

/**
 * Working agreements that hold for every build here, whatever the project
 * selected. They are house rules rather than preferences — a prompt that
 * silently dropped them because a starter did not tick the box would be the
 * bug, so they are appended rather than offered.
 */
const houseRuleIds = ["git-permission", "story-docs", "kt-doc", "reuse-components"]

function conventionsBlock(doc: ProjectDoc): string {
  const platform = platformOf(doc.stack)
  const ids = [
    ...doc.conventions.ids,
    ...houseRuleIds,
    // Only meaningful on Next — elsewhere it would be noise.
    ...(doc.stack.framework.startsWith("next") ? ["next-proxy"] : []),
  ]
  const overrides = conventionOverrides[platform]
  const lines = Array.from(new Set(ids))
    // A rule that cannot apply on this platform is worse than no rule: it
    // teaches the reader that these lines are boilerplate to skim.
    .filter((id) => platform === "web" || !webOnlyConventionIds.includes(id))
    .map((id) => overrides[id] ?? conventionMap[id]?.line ?? id)
    .filter(Boolean)
  const custom = doc.conventions.custom.trim()
  if (!lines.length && !custom) return ""
  return [list(lines), custom ? `\n${custom}` : ""].filter(Boolean).join("\n")
}

function requirementsBlock(doc: ProjectDoc): string {
  // The baseline is chosen by platform, not appended to a web one — see
  // features/stack/data/platforms.ts.
  const lines = [...platformRequirements[platformOf(doc.stack)]]
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
      doc.modules.length
        ? `Deliver every module listed under its screen — all ${doc.modules.length} of them — including the transitions between them. A screen missing its modules is not delivered.`
        : "",
      "No placeholder text, TODO comments or stubbed handlers.",
      ...platformDelivery[platformOf(doc.stack)],
      "State any assumption you had to make at the end of your response, in one short list.",
    ].filter(Boolean)
  )
}

const titles: Record<BlockId, string> = {
  overview: "Overview",
  screens: "Screens",
  navigation: "Navigation & Flow",
  views: "Roles & Access",
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

/**
 * Builds the prompt for **one surface**. Web, mobile and backend are separate
 * builds with separate stacks and separate repos; one prompt covering all three
 * would describe an app nobody is writing.
 */
export function buildPrompt(
  doc: ProjectDoc,
  options: { surface?: Surface } = {}
): BuiltPrompt {
  const surface = options.surface ?? "web"
  const doc_ = scopeToSurface(doc, surface)
  return buildForScope(doc_, surface)
}

/**
 * Narrows the document to one surface: its screens, the transitions between
 * them, their modules, and that surface's own stack and folder structure. The
 * landing page belongs to the web build only.
 */
function scopeToSurface(doc: ProjectDoc, surface: Surface): ProjectDoc {
  const screens = doc.screens.filter((s) => s.surface === surface)
  const ids = new Set(screens.map((s) => s.id))
  const modules = doc.modules.filter((m) => ids.has(m.screenId))
  const moduleIds = new Set(modules.map((m) => m.id))
  return {
    ...doc,
    screens,
    edges: doc.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    modules,
    moduleEdges: doc.moduleEdges.filter(
      (e) => moduleIds.has(e.from) && moduleIds.has(e.to)
    ),
    sections: surface === "web" ? doc.sections : [],
    stack: stackFor(doc, surface),
    structure: structureFor(doc, surface),
  }
}

function buildForScope(doc: ProjectDoc, surface: Surface): BuiltPrompt {
  const target = getTarget(doc.target)
  const bodies: Record<BlockId, string> = {
    overview: overviewBlock(doc),
    screens: screensBlock(doc),
    navigation: navigationBlock(doc),
    views: viewsBlock(doc),
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

  const name =
    surface === "web" ? doc.name : `${doc.name} — ${surfaceMeta[surface].label}`
  const text = [target.preamble(name), rendered, target.closing]
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

  // Views only mean something if screens are actually tagged. A project with
  // roles where almost nothing is tagged looks fine on the canvas but every
  // view shows the whole app — the most likely cause is a reverse-engineered
  // file that tagged one role's screens and left the rest bare.
  if (doc.views.length && doc.screens.length) {
    const untagged = doc.screens.filter((s) => s.views.length === 0).length
    const share = untagged / doc.screens.length
    if (share > 0.6 && doc.screens.length > 4) {
      warnings.push(
        `${untagged} of ${doc.screens.length} screens have no role tag, so they appear in every view — selecting a role will show almost the whole app. Tag the screens each role can actually reach.`
      )
    }
    for (const view of doc.views) {
      if (!doc.screens.some((s) => s.views.includes(view.id))) {
        warnings.push(
          `No screen is tagged for "${view.name}" — that view shows exactly the same thing as every other.`
        )
      }
    }
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

  // A web-only builder cannot ship a phone app, and its preamble promises a
  // responsive web app regardless of what the screens say.
  const target = getTarget(doc.target)
  if (target.webOnly && platformOf(doc.stack) !== "web") {
    warnings.push(
      `${target.name} builds web apps — for a native build, switch the target to Claude Code.`
    )
  }

  if (doc.structure.preset === "custom" && !doc.structure.customTree.trim()) {
    warnings.push("Custom folder structure selected but no tree pasted in.")
  }
  return warnings
}
