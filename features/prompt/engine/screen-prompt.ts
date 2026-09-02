import { surfaceMeta } from "@/features/builder/utils/surfaces"
import { describeLayout } from "@/features/library/data/layouts"
import { describeModuleKind } from "@/features/library/data/module-kinds"
import { screenTemplateMap } from "@/features/library/data/templates"
import type {
  FlowGroup,
  ProjectDoc,
  Screen,
  ScreenModule,
  Surface,
} from "@/types/project"

import { buildPrompt, list, storyLines } from "./build-prompt"
import { dataModelBlock } from "./data-model"
import { verificationNotice } from "./security"

/**
 * One screen's brief, complete enough to hand to an agent on its own.
 *
 * The builder's tabs split a product by surface, which is the right way to draw
 * it and the wrong way to build one piece of it: a dispatcher board is not
 * finished when the web screen renders, it is finished when the endpoint it
 * reads exists, the phone screen showing the same job agrees with it, and the
 * tables underneath hold what both of them write. Copying the brief from the
 * web tab and getting only the web half is how those three drift apart.
 *
 * So this ignores the tab entirely. Whichever surface the selected screen is
 * on, the prompt carries its counterparts on every other surface, reached
 * through the flows they share — the only link the document actually records
 * between a screen and its API.
 */

type Counterpart = { surface: Surface; screen: Screen; via: FlowGroup[] }

const surfaceOrder: Surface[] = ["web", "mobile", "backend"]

function modulesOf(doc: ProjectDoc, screenId: string): ScreenModule[] {
  return doc.modules
    .filter((module) => module.screenId === screenId)
    .sort((a, b) => a.order - b.order)
}

function flowsOf(doc: ProjectDoc, screen: Screen): FlowGroup[] {
  return doc.flows
    .filter((flow) => screen.flows.includes(flow.id))
    .sort((a, b) => a.order - b.order)
}

function viewNamesOf(doc: ProjectDoc, screen: Screen): string[] {
  // Empty means every view, which is the common case and not worth a line.
  if (!screen.views.length) return []
  return doc.views.filter((view) => screen.views.includes(view.id)).map((v) => v.name)
}

/**
 * Screens on *other* surfaces that share at least one flow with this one.
 *
 * Keys are prefixed per surface (`login`, `app_signin`, `api_auth`), so name
 * matching would find nothing. Flow membership is the real edge.
 */
export function counterpartsOf(doc: ProjectDoc, screen: Screen): Counterpart[] {
  const flows = flowsOf(doc, screen)
  if (!flows.length) return []
  return doc.screens
    .filter((other) => other.id !== screen.id && other.surface !== screen.surface)
    .map((other) => ({
      surface: other.surface,
      screen: other,
      via: flows.filter((flow) => other.flows.includes(flow.id)),
    }))
    .filter((entry) => entry.via.length > 0)
    .sort(
      (a, b) =>
        surfaceOrder.indexOf(a.surface) - surfaceOrder.indexOf(b.surface) ||
        a.screen.key.localeCompare(b.screen.key)
    )
}

function describeModules(modules: ScreenModule[], indent = ""): string[] {
  return modules.map((module) => {
    const kind = describeModuleKind(module.kind)
    const parts = [`\`${module.key}\` — ${module.name} (${kind.name})`]
    if (module.trigger.trim()) parts.push(`opened by: ${module.trigger.trim()}`)
    if (module.note.trim()) parts.push(module.note.trim())
    return `${indent}${parts.join(". ")}`
  })
}

function screenHeading(doc: ProjectDoc, screen: Screen): string[] {
  const lines: string[] = []
  const layout = describeLayout(screen.layout)
  const template = screenTemplateMap[screen.template]

  lines.push(`Key: \`${screen.key}\``)
  lines.push(`Build: ${surfaceMeta[screen.surface].label}`)
  if (template) lines.push(`Pattern: ${template.name} — ${template.description}`)
  if (layout) lines.push(`Layout: ${layout.name} — ${layout.description}`)
  const views = viewNamesOf(doc, screen)
  if (views.length) lines.push(`Only visible to: ${views.join(", ")}`)
  if (screen.note.trim()) lines.push(screen.note.trim())
  return lines
}

/** Transitions in and out, named by title so the agent can follow them. */
function connectionLines(doc: ProjectDoc, screen: Screen): string[] {
  const byId = new Map(doc.screens.map((s) => [s.id, s]))
  const lines: string[] = []

  for (const edge of doc.edges) {
    const trigger = edge.trigger.trim()
    if (edge.from === screen.id) {
      const to = byId.get(edge.to)
      if (to) {
        lines.push(
          `Leaves to **${to.title}** (\`${to.key}\`)${trigger ? ` — ${trigger}` : ""}`
        )
      }
    }
    if (edge.to === screen.id) {
      const from = byId.get(edge.from)
      if (from) {
        lines.push(
          `Arrives from **${from.title}** (\`${from.key}\`)${trigger ? ` — ${trigger}` : ""}`
        )
      }
    }
  }
  return lines
}

function flowSection(flows: FlowGroup[]): string {
  const blocks = flows.map((flow) => {
    const lines = [`**${flow.name}** (\`${flow.key}\`)`]
    if (flow.note.trim()) lines.push(flow.note.trim())
    lines.push(...storyLines(flow.story, ""))
    return lines.join("\n")
  })
  return blocks.join("\n\n")
}

function counterpartSection(doc: ProjectDoc, counterparts: Counterpart[]): string {
  const groups = surfaceOrder
    .map((surface) => ({
      surface,
      entries: counterparts.filter((entry) => entry.surface === surface),
    }))
    .filter((group) => group.entries.length > 0)

  return groups
    .map((group) => {
      const body = group.entries
        .map((entry) => {
          const { screen } = entry
          const lines = [
            `**${screen.title}** (\`${screen.key}\`) — shares: ${entry.via
              .map((flow) => flow.name)
              .join(", ")}`,
          ]
          if (screen.note.trim()) lines.push(screen.note.trim())
          lines.push(...storyLines(screen.story, ""))
          const modules = modulesOf(doc, screen.id)
          if (modules.length) {
            lines.push(
              group.surface === "backend" ? "Endpoints:" : "Parts:",
              ...describeModules(modules, "- ")
            )
          }
          return lines.join("\n")
        })
        .join("\n\n")
      return `### ${surfaceMeta[group.surface].label}\n\n${body}`
    })
    .join("\n\n")
}

export type BuiltScreenPrompt = {
  text: string
  /** surfaces the brief actually reached, for the button's own copy */
  surfaces: Surface[]
  warnings: string[]
}

export function buildScreenPrompt(doc: ProjectDoc, screenId: string): BuiltScreenPrompt {
  const screen = doc.screens.find((s) => s.id === screenId)
  if (!screen) {
    return { text: "", surfaces: [], warnings: ["That screen is no longer in the project."] }
  }

  const flows = flowsOf(doc, screen)
  const counterparts = counterpartsOf(doc, screen)
  const modules = modulesOf(doc, screen.id)
  const connections = connectionLines(doc, screen)
  const warnings: string[] = []

  // Reused rather than restated: the design system, conventions and stack a
  // screen is built against are the project's, and a second description of
  // them here is a second description that can disagree.
  const context = buildPrompt(doc, { surface: screen.surface })
  const blockBody = (id: string) =>
    context.blocks.find((block) => block.id === id)?.body ?? ""

  if (!flows.length) {
    warnings.push(
      `"${screen.title}" is not tagged to a flow, so this brief has only its own build. Tag it to a flow to pull in the API and the other devices.`
    )
  }

  const sections: string[] = []
  const push = (title: string, body: string) => {
    if (body.trim()) sections.push(`## ${title}\n\n${body.trim()}`)
  }

  push("The Screen", list(screenHeading(doc, screen)))
  push("Why It Exists", storyLines(screen.story, "").join("\n"))
  push(
    screen.surface === "backend" ? "Endpoints" : "What Is On It",
    modules.length
      ? list(describeModules(modules))
      : "No parts recorded yet — build the screen from its layout and user story, and say what you added."
  )
  push("How It Connects", connections.length ? list(connections) : "")
  push("The Journeys It Belongs To", flows.length ? flowSection(flows) : "")
  push(
    "The Same Journey On The Other Builds",
    counterparts.length
      ? [
          "This screen is one part of the flows above. These are the other parts, on the other builds. Whatever contract they imply — endpoint shapes, field names, status values — must match here exactly.",
          counterpartSection(doc, counterparts),
        ].join("\n\n")
      : ""
  )
  push("Data Model", dataModelBlock(doc))
  push("Tech Stack", blockBody("stack"))
  push("Design System", blockBody("design"))
  // A screen built without the token contract is a screen that invents its own
  // colours, and one screen off the system is more obvious than all of them.
  push("Design Tokens — Write These First", blockBody("tokens"))
  push("Interface Craft", blockBody("ui_conventions"))
  push("Conventions", blockBody("conventions"))

  // From the scoped context, not `doc.stack` — `doc.stack` is always the WEB
  // stack, so reading it here told a FastAPI or Expo screen brief to install
  // and verify a Next.js version.
  push("Dependency Versions — Non-Negotiable", blockBody("security"))

  const preamble = [
    `Build **${screen.title}** for **${doc.name}** — the ${surfaceMeta[screen.surface].label} build.`,
    counterparts.length
      ? "This brief covers the screen and everything the rest of the system expects of it: its API, its counterparts on the other builds, the tables underneath, and the user stories all of them serve. Implement this screen; use the rest as the contract you build against, and say so if any of it is missing."
      : "Implement this screen completely — every state, wired to its transitions, no placeholders and no TODOs.",
  ].join("\n\n")

  const text = [preamble, ...sections, verificationNotice("markdown")].join("\n\n")

  const surfaces = [
    screen.surface,
    ...counterparts.map((entry) => entry.surface),
  ].filter((surface, index, all) => all.indexOf(surface) === index)

  return { text, surfaces, warnings }
}
