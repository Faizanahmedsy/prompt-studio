import { autoLayout } from "@/features/builder/utils/graph"
import { allLayouts } from "@/features/library/data/layouts"
import { sectionTypes } from "@/features/library/data/section-types"
import { snippets } from "@/features/library/data/snippets"
import { screenTemplates } from "@/features/library/data/templates"
import { conventions } from "@/features/stack/data/conventions"
import { stackGroups } from "@/features/stack/data/stack-catalogue"
import { structurePresets } from "@/features/stack/data/structures"
import { slugify, uid, uniqueKey } from "@/lib/utils"
import {
  type FlowEdge,
  type ProjectDoc,
  type Screen,
  type Section,
  projectDocSchema,
} from "@/types/project"

import { promptTargets } from "@/features/prompt/engine/targets"

import {
  closestMatch,
  readQuoted,
  resolveHeredoc,
  tokenize,
} from "./tokenize"

export type ParseIssue = { line: number; message: string }

export type ParseResult = {
  doc: ProjectDoc
  /** a `profile "..."` statement — the caller expands it */
  profile?: string
  warnings: ParseIssue[]
  errors: ParseIssue[]
}

const layoutIds = allLayouts.map((l) => l.id)
const templateIds = screenTemplates.map((t) => t.id)
const sectionTypeIds = sectionTypes.map((s) => s.id)
const conventionIds = conventions.map((c) => c.id)
const snippetIds = snippets.map((s) => s.id)
const structureIds = structurePresets.map((s) => s.id)
const targetIds = promptTargets.map((t) => t.id)

const radiusAliases: Record<string, string> = {
  none: "none",
  "0": "none",
  square: "none",
  sm: "small",
  small: "small",
  md: "medium",
  medium: "medium",
  lg: "large",
  large: "large",
  xl: "large",
  full: "full",
  pill: "full",
  rounded: "full",
}

const buttonAliases: Record<string, string> = {
  filled: "filled",
  solid: "filled",
  outlined: "outlined",
  outline: "outlined",
  ghost: "outlined",
  rounded: "rounded",
  pill: "rounded",
  sharp: "sharp",
  square: "sharp",
}

const densityAliases: Record<string, string> = {
  compact: "compact",
  dense: "compact",
  comfortable: "comfortable",
  normal: "comfortable",
  default: "comfortable",
  spacious: "spacious",
  roomy: "spacious",
}

type Ctx =
  | { kind: "root" }
  | { kind: "app" }
  | { kind: "theme" }
  | { kind: "screen"; id: string }
  | { kind: "flow" }
  | { kind: "landing" }
  | { kind: "stack" }
  | { kind: "unknown" }

/**
 * Parses `.flow` source into a project document.
 *
 * Tolerance is the whole point: braces, semicolons and quotes are optional,
 * `->` `→` `=>` all connect, unknown ids are fuzzy-matched and warned about
 * rather than dropped, and screens referenced but never declared are created.
 */
export function parseFlow(source: string): ParseResult {
  const { lines, heredocs } = tokenize(source)
  const warnings: ParseIssue[] = []
  const errors: ParseIssue[] = []

  const doc: ProjectDoc = projectDocSchema.parse({})
  const screens: Screen[] = []
  const edges: FlowEdge[] = []
  const sections: Section[] = []
  const byKey = new Map<string, Screen>()
  let profile: string | undefined

  const stack: Ctx[] = [{ kind: "root" }]
  let pending: Ctx | null = null
  const ctx = () => stack[stack.length - 1]

  const ensureScreen = (rawKey: string, line: number, title?: string) => {
    const key = slugify(rawKey)
    const existing = byKey.get(key)
    if (existing) {
      if (title) existing.title = title
      return existing
    }
    const screen: Screen = {
      id: uid("scr"),
      key: uniqueKey(key, byKey.keys()),
      title: title || titleFromKey(key),
      template: "",
      layout: "",
      note: "",
      x: 0,
      y: 0,
    }
    screens.push(screen)
    byKey.set(screen.key, screen)
    return screen
  }

  const matchId = (
    value: string,
    candidates: string[],
    label: string,
    line: number
  ) => {
    const normalised = value.trim()
    if (!normalised) return ""
    if (candidates.includes(normalised)) return normalised
    const suggestion = closestMatch(normalised, candidates)
    if (suggestion) {
      warnings.push({
        line,
        message: `Unknown ${label} "${normalised}" — using "${suggestion}".`,
      })
      return suggestion
    }
    warnings.push({
      line,
      message: `Unknown ${label} "${normalised}" — kept as-is; the prompt will describe it literally.`,
    })
    return normalised
  }

  for (const entry of lines) {
    const { line } = entry
    const raw = entry.text.trim()
    if (!raw) continue

    if (raw === "{") {
      stack.push(pending ?? { kind: "unknown" })
      pending = null
      continue
    }
    if (raw === "}") {
      if (stack.length > 1) stack.pop()
      else errors.push({ line, message: "Unmatched `}`." })
      pending = null
      continue
    }

    // A header that did not open a block applies immediately; drop it.
    pending = null

    const { rest, quoted } = readQuoted(raw)
    const words = rest.split(/[\s,]+/).filter(Boolean)
    const keyword = (words[0] ?? "").toLowerCase()
    const current = ctx()

    // ------------------------------------------------------------ flow block
    if (current.kind === "flow" || /(->|=>|→)/.test(raw)) {
      const trigger = quoted[0] ?? ""
      const chain = rest
        .split(/->|=>|→/)
        .map((part) => part.replace(/:.*$/, "").trim())
        .filter(Boolean)
      if (chain.length >= 2) {
        for (let i = 0; i < chain.length - 1; i += 1) {
          const from = ensureScreen(chain[i], line)
          const to = ensureScreen(chain[i + 1], line)
          if (from.id === to.id) {
            warnings.push({ line, message: `"${from.title}" cannot connect to itself.` })
            continue
          }
          if (edges.some((e) => e.from === from.id && e.to === to.id)) {
            warnings.push({
              line,
              message: `Duplicate connection ${from.key} → ${to.key} ignored.`,
            })
            continue
          }
          edges.push({
            id: uid("edg"),
            from: from.id,
            to: to.id,
            // A chain shares one label only between its first pair.
            trigger: i === 0 ? trigger : "",
          })
        }
        continue
      }
      if (current.kind === "flow") {
        if (chain.length === 1) {
          ensureScreen(chain[0], line)
          continue
        }
        errors.push({ line, message: `Could not read connection: "${raw}".` })
        continue
      }
    }

    // ----------------------------------------------------------- theme block
    if (current.kind === "theme") {
      const value = words.slice(1).join(" ").trim() || quoted[0] || ""
      applyThemeProp(doc, keyword, value, line, warnings)
      continue
    }

    // ----------------------------------------------------------- stack block
    if (current.kind === "stack") {
      if (keyword === "extras" || keyword === "extra") {
        const extras = [
          ...words.slice(1),
          ...quoted,
        ]
          .map((v) => v.trim())
          .filter(Boolean)
        doc.stack.extras = [...doc.stack.extras, ...extras]
        continue
      }
      const group = stackGroups.find(
        (g) => g.key.toLowerCase() === keyword || g.label.toLowerCase() === keyword
      )
      const value = words[1] ?? quoted[0] ?? ""
      if (group) {
        const ids = group.options.map((o) => o.id)
        doc.stack[group.key] = matchId(value, ids, `${group.label} option`, line)
      } else if (value) {
        doc.stack.extras.push(`${keyword}: ${value}`)
        warnings.push({
          line,
          message: `Unknown stack key "${keyword}" — added to extras.`,
        })
      }
      continue
    }

    // --------------------------------------------------------- landing block
    if (current.kind === "landing" || keyword === "section") {
      if (keyword !== "section") {
        errors.push({ line, message: `Expected a \`section\` statement, got "${raw}".` })
        continue
      }
      const type = matchId(words[1] ?? "", sectionTypeIds, "section type", line)
      const layoutWord = words.indexOf("layout")
      const layoutValue = layoutWord !== -1 ? (words[layoutWord + 1] ?? "") : ""
      const sectionLayouts = allLayouts
        .filter((l) => l.scope === "section")
        .map((l) => l.id)
      const meta = sectionTypes.find((s) => s.id === type)
      sections.push({
        id: uid("sec"),
        type,
        name: quoted[0] || meta?.name || type,
        layout: layoutValue
          ? matchId(layoutValue, sectionLayouts, "layout", line)
          : (meta?.defaultLayout ?? ""),
        note: quoted[1] ?? "",
        order: sections.length,
      })
      continue
    }

    // ---------------------------------------------------------- screen block
    if (current.kind === "screen") {
      const screen = screens.find((s) => s.id === current.id)
      if (!screen) continue
      const value = words.slice(1).join(" ").trim()
      switch (keyword) {
        case "template":
        case "type":
          screen.template = matchId(value || quoted[0] || "", templateIds, "screen type", line)
          if (!screen.layout) {
            const template = screenTemplates.find((t) => t.id === screen.template)
            if (template) screen.layout = template.defaultLayout
          }
          break
        case "layout":
          screen.layout = matchId(value || quoted[0] || "", layoutIds, "layout", line)
          break
        case "title":
          screen.title = quoted[0] || value
          break
        case "note":
        case "notes":
        case "description":
          screen.note = resolveHeredoc(quoted[0] ?? value, heredocs)
          break
        default:
          warnings.push({
            line,
            message: `Unknown screen property "${keyword}" — ignored.`,
          })
      }
      continue
    }

    // ------------------------------------------------------------ app / root
    switch (keyword) {
      case "app":
      case "project": {
        doc.name = quoted[0] || words.slice(1).join(" ") || doc.name
        pending = { kind: "app" }
        continue
      }
      case "screen":
      case "page": {
        const key = words[1] ?? slugify(quoted[0] ?? "screen")
        const screen = ensureScreen(key, line, quoted[0])
        pending = { kind: "screen", id: screen.id }
        continue
      }
      case "flow":
      case "navigation": {
        pending = { kind: "flow" }
        continue
      }
      case "landing":
      case "page_sections":
      case "sections": {
        pending = { kind: "landing" }
        continue
      }
      case "stack": {
        pending = { kind: "stack" }
        continue
      }
      case "theme": {
        pending = { kind: "theme" }
        continue
      }
      case "target": {
        doc.target = matchId(words[1] ?? quoted[0] ?? "", targetIds, "target", line)
        continue
      }
      case "creativity": {
        const level = Number(words[1])
        if (Number.isFinite(level)) {
          doc.creativity = Math.max(0, Math.min(10, Math.round(level)))
        } else {
          warnings.push({ line, message: `Creativity must be 0–10, got "${words[1]}".` })
        }
        continue
      }
      case "name": {
        doc.name = quoted[0] || words.slice(1).join(" ") || doc.name
        continue
      }
      case "structure": {
        const value = words[1] ?? ""
        if (value.toLowerCase() === "custom") {
          doc.structure.preset = "custom"
          doc.structure.customTree = resolveHeredoc(
            words.slice(2).join(" ") || quoted[0] || "",
            heredocs
          )
        } else {
          doc.structure.preset = matchId(value, structureIds, "folder structure", line)
        }
        continue
      }
      case "conventions": {
        const items = bracketList(rest).concat(quoted)
        doc.conventions.ids = items
          .map((item) => matchId(item, conventionIds, "convention", line))
          .filter(Boolean)
        continue
      }
      case "snippets": {
        const items = bracketList(rest).concat(quoted)
        doc.snippetIds = items
          .map((item) => matchId(item, snippetIds, "snippet", line))
          .filter(Boolean)
        continue
      }
      case "conventions_note":
      case "house_rules": {
        doc.conventions.custom = resolveHeredoc(
          words.slice(1).join(" ") || quoted[0] || "",
          heredocs
        ).trim()
        continue
      }
      case "profile": {
        profile = quoted[0] ?? words.slice(1).join(" ")
        continue
      }
      case "requirements":
      case "notes": {
        doc.requirements = resolveHeredoc(
          words.slice(1).join(" ") || quoted[0] || "",
          heredocs
        ).trim()
        continue
      }
      default: {
        if (current.kind === "app") {
          warnings.push({ line, message: `Unknown app property "${keyword}" — ignored.` })
        } else {
          warnings.push({ line, message: `Could not understand "${raw}" — ignored.` })
        }
      }
    }
  }

  if (stack.length > 1) {
    warnings.push({
      line: lines.at(-1)?.line ?? 1,
      message: `${stack.length - 1} block(s) left unclosed — assumed closed at the end.`,
    })
  }

  // Fill in sensible defaults for screens declared without a layout.
  for (const screen of screens) {
    if (!screen.layout && screen.template) {
      const template = screenTemplates.find((t) => t.id === screen.template)
      if (template) screen.layout = template.defaultLayout
    }
  }

  doc.screens = autoLayout(screens, edges)
  doc.edges = edges
  doc.sections = sections

  if (!screens.length && !sections.length) {
    errors.push({
      line: 1,
      message: "No screens or sections found — is this Flow source?",
    })
  }

  return { doc, profile, warnings, errors }
}

function titleFromKey(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function bracketList(text: string) {
  const match = text.match(/\[([^\]]*)\]/)
  const body = match ? match[1] : text.replace(/^\s*\w+/, "")
  return body
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter((v) => v && v !== "[" && v !== "]")
}

function applyThemeProp(
  doc: ProjectDoc,
  key: string,
  value: string,
  line: number,
  warnings: ParseIssue[]
) {
  const normalised = value.trim().toLowerCase()
  switch (key) {
    case "primary":
    case "primarycolor":
      doc.theme.primaryColor = normaliseColor(value, doc.theme.primaryColor, line, warnings)
      return
    case "secondary":
    case "secondarycolor":
    case "accent":
      doc.theme.secondaryColor = normaliseColor(value, doc.theme.secondaryColor, line, warnings)
      return
    case "radius":
    case "borderradius":
      doc.theme.borderRadius = (radiusAliases[normalised] ??
        doc.theme.borderRadius) as ProjectDoc["theme"]["borderRadius"]
      return
    case "buttons":
    case "buttonstyle":
      doc.theme.buttonStyle = (buttonAliases[normalised] ??
        doc.theme.buttonStyle) as ProjectDoc["theme"]["buttonStyle"]
      return
    case "density":
    case "spacing":
      doc.theme.density = (densityAliases[normalised] ??
        doc.theme.density) as ProjectDoc["theme"]["density"]
      return
    default:
      warnings.push({ line, message: `Unknown theme property "${key}" — ignored.` })
  }
}

function normaliseColor(
  value: string,
  fallback: string,
  line: number,
  warnings: ParseIssue[]
) {
  const trimmed = value.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed
  if (/^([0-9a-f]{6})$/i.test(trimmed)) return `#${trimmed}`
  warnings.push({
    line,
    message: `"${trimmed}" is not a hex colour — keeping ${fallback}.`,
  })
  return fallback
}
