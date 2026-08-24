import { autoLayout } from "@/features/builder/utils/graph"
import { allLayouts } from "@/features/library/data/layouts"
import { moduleKinds } from "@/features/library/data/module-kinds"
import { sectionTypes } from "@/features/library/data/section-types"
import { snippets } from "@/features/library/data/snippets"
import { screenTemplates } from "@/features/library/data/templates"
import { promptTargets } from "@/features/prompt/engine/targets"
import { conventions } from "@/features/stack/data/conventions"
import { stackGroups } from "@/features/stack/data/stack-catalogue"
import { structurePresets } from "@/features/stack/data/structures"
import { designLanguages } from "@/features/theme/data/design-languages"
import { slugify, uid, uniqueKey } from "@/lib/utils"
import {
  type FlowEdge,
  type FlowGroup,
  type FlowView,
  type ModuleEdge,
  type ProjectDoc,
  projectDocSchema,
  type Screen,
  type ScreenModule,
  type Section,
  surfaceValues,
  type UserStory,
} from "@/types/project"

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
const moduleKindIds = moduleKinds.map((k) => k.id)

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
  | { kind: "module"; id: string; screenId: string }
  | { kind: "inner"; screenId: string }
  | { kind: "flow" }
  | { kind: "views" }
  | { kind: "flows" }
  | { kind: "flowGroup"; id: string }
  /**
   * A `story { … }` body. It holds the story object itself rather than an id
   * because a story hangs off either a screen or a flow, and threading "which
   * kind of parent" through would buy nothing. `collecting` is true while a
   * multi-line `accept [ … ]` list is still open.
   */
  | { kind: "story"; story: UserStory; collecting: boolean }
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
  const modules: ScreenModule[] = []
  const moduleEdges: ModuleEdge[] = []
  const sections: Section[] = []
  const views: FlowView[] = []
  const flows: FlowGroup[] = []
  const byKey = new Map<string, Screen>()
  let profile: string | undefined

  const stack: Ctx[] = [{ kind: "root" }]
  let pending: Ctx | null = null
  const ctx = () => stack[stack.length - 1]

  const ensureScreen = (rawKey: string, _line: number, title?: string) => {
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
      surface: "web",
      views: [],
      flows: [],
      story: emptyStory(),
      x: 0,
      y: 0,
    }
    screens.push(screen)
    byKey.set(screen.key, screen)
    return screen
  }

  /**
   * Module keys are unique per screen, not per project — two screens may each
   * own a plain `table`. Referencing a module that was never declared creates
   * it, the same tolerance `flow` blocks get for screens.
   */
  const ensureModule = (screenId: string, rawKey: string, name?: string) => {
    const key = slugify(rawKey)
    const siblings = modules.filter((m) => m.screenId === screenId)
    const existing = siblings.find((m) => m.key === key)
    if (existing) {
      if (name) existing.name = name
      return existing
    }
    const module: ScreenModule = {
      id: uid("mod"),
      screenId,
      key: uniqueKey(
        key,
        siblings.map((m) => m.key)
      ),
      name: name || titleFromKey(key),
      kind: "panel",
      trigger: "",
      note: "",
      order: siblings.length,
    }
    modules.push(module)
    return module
  }

  /**
   * Views are declared in a `views { … }` block, but a screen may also name one
   * that was never declared — creating it is the same tolerance screens get
   * inside a `flow` block, and losing a role tag silently would be worse.
   */
  const ensureView = (rawKey: string, name?: string) => {
    const key = slugify(rawKey)
    if (!key) return null
    const existing = views.find((v) => v.key === key)
    if (existing) {
      if (name) existing.name = name
      return existing
    }
    const view: FlowView = {
      id: uid("vw"),
      key,
      name: name || titleFromKey(key),
      note: "",
    }
    views.push(view)
    return view
  }

  /**
   * Flow groups, like views, may be named before they are declared — a screen
   * tagged `flows [auth]` in a file whose `flows { … }` block the model forgot
   * should still be grouped, not silently ungrouped.
   */
  const ensureFlow = (rawKey: string, name?: string) => {
    const key = slugify(rawKey)
    if (!key) return null
    const existing = flows.find((f) => f.key === key)
    if (existing) {
      if (name) existing.name = name
      return existing
    }
    const flow: FlowGroup = {
      id: uid("flw"),
      key,
      name: name || titleFromKey(key),
      story: emptyStory(),
      note: "",
      order: flows.length,
    }
    flows.push(flow)
    return flow
  }

  /** `@super_admin @admin` anywhere on a line — the view tags for a transition. */
  const readViewTags = (text: string) => {
    const ids: string[] = []
    for (const match of text.matchAll(/@([a-z0-9_-]+)/gi)) {
      const view = ensureView(match[1])
      if (view && !ids.includes(view.id)) ids.push(view.id)
    }
    return ids
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

    // ------------------------------------------------- inner (module) flow
    // Checked before the screen-level flow block, otherwise the arrow test
    // below would claim these lines and wire module keys into screens.
    if (current.kind === "inner") {
      const trigger = quoted[0] ?? ""
      const chain = rest
        .split(/->|=>|→/)
        .map((part) => part.replace(/:.*$/, "").trim())
        .filter(Boolean)
      if (chain.length === 1) {
        ensureModule(current.screenId, chain[0])
        continue
      }
      if (chain.length < 2) {
        errors.push({ line, message: `Could not read inner connection: "${raw}".` })
        continue
      }
      for (let i = 0; i < chain.length - 1; i += 1) {
        const from = ensureModule(current.screenId, chain[i])
        const to = ensureModule(current.screenId, chain[i + 1])
        if (from.id === to.id) {
          warnings.push({ line, message: `"${from.name}" cannot connect to itself.` })
          continue
        }
        if (moduleEdges.some((e) => e.from === from.id && e.to === to.id)) {
          warnings.push({
            line,
            message: `Duplicate inner connection ${from.key} → ${to.key} ignored.`,
          })
          continue
        }
        moduleEdges.push({
          id: uid("med"),
          from: from.id,
          to: to.id,
          trigger: i === 0 ? trigger : "",
        })
      }
      continue
    }

    // ---------------------------------------------------------- module block
    if (current.kind === "module") {
      const module = modules.find((m) => m.id === current.id)
      if (!module) continue
      const value = words.slice(1).join(" ").trim()
      switch (keyword) {
        case "kind":
        case "type":
          module.kind = matchId(
            value || quoted[0] || "",
            moduleKindIds,
            "module kind",
            line
          )
          break
        case "on":
        case "trigger":
        case "when":
          module.trigger = quoted[0] ?? value
          break
        case "name":
        case "title":
          module.name = quoted[0] || value
          break
        case "note":
        case "notes":
        case "description":
          module.note = resolveHeredoc(quoted[0] ?? value, heredocs)
          break
        default:
          warnings.push({
            line,
            message: `Unknown module property "${keyword}" — ignored.`,
          })
      }
      continue
    }

    // ----------------------------------------------------------- story block
    // Before the arrow test below, deliberately: an acceptance criterion may
    // legitimately read "login -> dashboard", and that must not be mistaken
    // for a transition.
    if (current.kind === "story") {
      const story = current.story

      if (current.collecting) {
        pushCriteria(story, raw, heredocs)
        if (raw.includes("]")) current.collecting = false
        continue
      }

      const inline = (quoted[0] ?? words.slice(1).join(" ")).trim()
      const value = resolveHeredoc(inline, heredocs).trim()
      switch (keyword) {
        case "as":
        case "as_a":
        case "role":
        case "persona":
        case "who":
          story.role = stripLead(value, /^as\s+(a|an|the)\s+/i)
          break
        case "want":
        case "wants":
        case "i_want":
        case "iwant":
        case "goal":
        case "need":
          story.want = stripLead(value, /^i\s+want\s+(to\s+)?/i)
          break
        case "so":
        case "so_that":
        case "sothat":
        case "benefit":
        case "value":
        case "why":
          story.soThat = stripLead(value, /^so\s+that\s+/i)
          break
        case "accept":
        case "acceptance":
        case "acceptance_criteria":
        case "criteria":
        case "ac":
        case "given": {
          const items = quoted.length ? quoted : bracketList(rest)
          const heredoc = rest.match(/«H\d+»/)
          if (heredoc) {
            for (const line of resolveHeredoc(heredoc[0], heredocs).split("\n")) {
              const text = line.replace(/^\s*[-*•]\s*/, "").trim()
              if (text) story.criteria.push(text)
            }
          } else {
            for (const item of items) {
              const text = item.trim()
              if (text) story.criteria.push(text)
            }
          }
          // `accept [` on its own opens a list that runs over several lines.
          if (raw.includes("[") && !raw.includes("]")) current.collecting = true
          break
        }
        default:
          warnings.push({
            line,
            message: `Unknown story property "${keyword}" — ignored.`,
          })
      }
      continue
    }

    // ----------------------------------------------------------- flows block
    if (current.kind === "flows") {
      const declares =
        keyword === "flow" || keyword === "journey" || keyword === "group"
      const key = declares
        ? (words[1] ?? slugify(quoted[0] ?? ""))
        : (words[0] ?? slugify(quoted[0] ?? ""))
      const flow = ensureFlow(key, quoted[0])
      if (!flow) {
        errors.push({ line, message: `Could not read flow: "${raw}".` })
        continue
      }
      if (quoted[1]) flow.note = quoted[1]
      pending = { kind: "flowGroup", id: flow.id }
      continue
    }

    if (current.kind === "flowGroup") {
      const flow = flows.find((f) => f.id === current.id)
      if (!flow) continue
      const inline = (quoted[0] ?? words.slice(1).join(" ")).trim()
      switch (keyword) {
        case "name":
        case "title":
          if (inline) flow.name = inline
          continue
        case "note":
        case "notes":
        case "description":
          flow.note = resolveHeredoc(inline, heredocs).trim()
          continue
        case "story":
        case "user_story":
        case "userstory": {
          if (quoted[0]) applyStorySentence(flow.story, quoted[0])
          pending = { kind: "story", story: flow.story, collecting: false }
          continue
        }
        case "screens":
        case "screen": {
          // Membership really lives on the screen. A model that lists screens
          // here anyway is understood rather than corrected — losing the
          // grouping over a matter of style would be the worse outcome.
          for (const item of bracketList(rest).concat(quoted)) {
            const screen = ensureScreen(item, line)
            if (!screen.flows.includes(flow.id)) screen.flows.push(flow.id)
          }
          continue
        }
        default:
          warnings.push({
            line,
            message: `Unknown flow property "${keyword}" — ignored.`,
          })
          continue
      }
    }

    // ------------------------------------------------------------ flow block
    if (current.kind === "flow" || /(->|=>|→)/.test(raw)) {
      const trigger = quoted[0] ?? ""
      const edgeViews = readViewTags(rest)
      const chain = rest
        .replace(/@[a-z0-9_-]+/gi, " ")
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
            views: edgeViews,
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

    // ------------------------------------------------------------ views block
    if (current.kind === "views") {
      // `super_admin "Super Admin"` — or just a bare key.
      const view = ensureView(words[0] ?? slugify(quoted[0] ?? ""), quoted[0])
      if (!view) {
        errors.push({ line, message: `Could not read view: "${raw}".` })
      } else if (quoted[1]) {
        view.note = quoted[1]
      }
      continue
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
        case "module":
        case "part":
        case "component": {
          const module = ensureModule(
            screen.id,
            words[1] ?? slugify(quoted[0] ?? "module"),
            quoted[0]
          )
          // `module table "Client table" kind table on "click row"` — the
          // compact one-line form, where a `{ … }` body never opens.
          const kindWord = words.indexOf("kind")
          if (kindWord !== -1 && words[kindWord + 1]) {
            module.kind = matchId(
              words[kindWord + 1],
              moduleKindIds,
              "module kind",
              line
            )
          }
          if (quoted[1]) module.trigger = quoted[1]
          pending = { kind: "module", id: module.id, screenId: screen.id }
          continue
        }
        case "surface":
        case "build":
        case "platform": {
          const value = (words[1] ?? quoted[0] ?? "").toLowerCase()
          const match = surfaceValues.find((v) => v === value)
          if (match) {
            screen.surface = match
          } else {
            warnings.push({
              line,
              message: `Unknown surface "${value}" — kept on web. Use one of ${surfaceValues.join(", ")}.`,
            })
          }
          continue
        }
        case "in":
        case "views":
        case "roles": {
          const items = bracketList(rest).concat(quoted)
          screen.views = items
            .map((item) => ensureView(item)?.id)
            .filter((id): id is string => Boolean(id))
          continue
        }
        case "inner":
        case "internal":
        case "module_flow": {
          pending = { kind: "inner", screenId: screen.id }
          continue
        }
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
        case "story":
        case "user_story":
        case "userstory": {
          // Both forms are accepted: a `story { … }` body, and the one-line
          // `story "As a … I want … so that …"` a model writes when it is
          // being terse.
          if (quoted[0]) {
            applyStorySentence(screen.story, resolveHeredoc(quoted[0], heredocs))
          }
          pending = { kind: "story", story: screen.story, collecting: false }
          break
        }
        case "flows":
        case "flow":
        case "journeys":
        case "journey": {
          for (const item of bracketList(rest).concat(quoted)) {
            const flow = ensureFlow(item)
            if (flow && !screen.flows.includes(flow.id)) screen.flows.push(flow.id)
          }
          break
        }
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
      case "views":
      case "roles":
      case "personas": {
        pending = { kind: "views" }
        continue
      }
      case "flows":
      case "journeys": {
        pending = { kind: "flows" }
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

  doc.views = views
  const viewIds = new Set(views.map((v) => v.id))
  for (const screen of screens) {
    screen.views = screen.views.filter((id) => viewIds.has(id))
  }

  flows.forEach((flow, index) => {
    flow.order = index
  })
  doc.flows = flows
  const flowIds = new Set(flows.map((f) => f.id))
  for (const screen of screens) {
    // A tag naming a flow that never materialised would render as a group
    // nothing can select, so it is dropped rather than kept as a ghost.
    screen.flows = [...new Set(screen.flows.filter((id) => flowIds.has(id)))]
  }
  for (const edge of edges) {
    edge.views = edge.views.filter((id) => viewIds.has(id))
  }

  doc.screens = autoLayout(screens, edges)
  doc.edges = edges
  doc.sections = sections
  // Modules of a deleted-or-never-declared screen would be unreachable data.
  const screenIds = new Set(screens.map((s) => s.id))
  doc.modules = modules.filter((m) => screenIds.has(m.screenId))
  const moduleIds = new Set(doc.modules.map((m) => m.id))
  doc.moduleEdges = moduleEdges.filter(
    (e) => moduleIds.has(e.from) && moduleIds.has(e.to)
  )

  if (!screens.length && !sections.length) {
    errors.push({
      line: 1,
      message: "No screens or sections found — is this Flow source?",
    })
  }

  return { doc, profile, warnings, errors }
}

function emptyStory(): UserStory {
  return { role: "", want: "", soThat: "", criteria: [] }
}

/**
 * Models restate the scaffolding they were given — `as "As a signed-in admin"`,
 * `want "I want to see every client"`. Storing that means rendering "As a As a
 * signed-in admin" in the prompt, so the lead-in comes off here, once, rather
 * than being worked around at every place a story is displayed.
 */
function stripLead(value: string, lead: RegExp) {
  return value.replace(lead, "").replace(/^[,\s]+/, "").replace(/[,.\s]+$/, "").trim()
}

/** The one-line form: `story "As a … I want … so that …"`. */
function applyStorySentence(story: UserStory, sentence: string) {
  const text = sentence.trim()
  if (!text) return
  const match = text.match(
    /^as\s+(?:an?|the)?\s*(.+?)[,\s]+i\s+want\s+(?:to\s+)?(.+?)(?:[,\s]+so\s+that\s+(.+))?$/i
  )
  if (!match) {
    // Not the canonical shape — keep it whole rather than throwing it away.
    if (!story.want) story.want = text
    return
  }
  if (!story.role) story.role = match[1].trim()
  if (!story.want) story.want = match[2].trim().replace(/[.,]$/, "")
  if (!story.soThat && match[3]) story.soThat = match[3].trim().replace(/[.]$/, "")
}

/** One line of a multi-line `accept [ … ]` list. */
function pushCriteria(story: UserStory, raw: string, heredocs: string[]) {
  const body = raw.replace(/[[\]]/g, " ")
  const { rest, quoted } = readQuoted(body)
  if (quoted.length) {
    for (const item of quoted) {
      const text = item.trim()
      if (text) story.criteria.push(text)
    }
    return
  }
  const text = resolveHeredoc(rest, heredocs)
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/,\s*$/, "")
    .trim()
  if (text) story.criteria.push(text)
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
    case "design":
    case "designlanguage":
    case "style": {
      const ids = designLanguages.map((d) => d.id)
      if (ids.includes(normalised)) {
        doc.theme.designLanguage = normalised
        return
      }
      const suggestion = closestMatch(normalised, ids)
      if (suggestion) {
        doc.theme.designLanguage = suggestion
        warnings.push({
          line,
          message: `Unknown design language "${value.trim()}" — using "${suggestion}".`,
        })
      } else {
        warnings.push({
          line,
          message: `Unknown design language "${value.trim()}" — keeping ${doc.theme.designLanguage}.`,
        })
      }
      return
    }
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
