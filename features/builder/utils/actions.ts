import {
  defaultLayoutFor,
  isMobileLayout,
} from "@/features/library/data/layouts"
import { moduleKindMap } from "@/features/library/data/module-kinds"
import { sectionTypeMap } from "@/features/library/data/section-types"
import { screenTemplateMap } from "@/features/library/data/templates"
import { slugify, uid, uniqueKey } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import type {
  FlowGroup,
  FlowView,
  ProjectDoc,
  Screen,
  ScreenModule,
  Section,
  Surface,
  UserStory,
} from "@/types/project"

import { autoLayout, edgeExists } from "./graph"

const update = (
  mutate: (doc: ProjectDoc) => void,
  options?: { coalesce?: string; silent?: boolean }
) => useProjectStore.getState().update(mutate, options)

/**
 * The surface the canvas is currently showing. Read here rather than threaded
 * through every caller: the library panel, the outline, the palette and the `n`
 * hotkey all add screens, and any one of them forgetting to pass it would drop
 * the screen onto Web where the user cannot see it.
 */
function currentSurface(): Surface {
  const mode = useUiStore.getState().mode
  return mode === "mobile" || mode === "backend" ? mode : "web"
}

export function addScreen(
  template = "",
  position?: { x: number; y: number },
  surface: Surface = currentSurface()
): string | null {
  let newId: string | null = null
  update((doc) => {
    const meta = screenTemplateMap[template]
    const base = meta?.name ?? `Screen ${doc.screens.length + 1}`
    const key = uniqueKey(
      slugify(base),
      doc.screens.map((s) => s.key)
    )
    const screen: Screen = {
      id: uid("scr"),
      key,
      title: base,
      template,
      layout: defaultLayoutFor(meta?.defaultLayout ?? "", surface),
      note: "",
      surface,
      views: [],
      flows: [],
      story: { role: "", want: "", soThat: "", criteria: [] },
      x: position?.x ?? 80 + (doc.screens.length % 4) * 260,
      y: position?.y ?? 80 + Math.floor(doc.screens.length / 4) * 180,
    }
    newId = screen.id
    doc.screens.push(screen)
  })
  return newId
}

export function updateScreen(id: string, patch: Partial<Screen>) {
  update((doc) => {
    const screen = doc.screens.find((s) => s.id === id)
    if (!screen) return
    if (patch.key) {
      patch.key = uniqueKey(
        slugify(patch.key),
        doc.screens.filter((s) => s.id !== id).map((s) => s.key)
      )
    }
    Object.assign(screen, patch)
  })
}

export function moveScreen(id: string, x: number, y: number) {
  update(
    (doc) => {
      const screen = doc.screens.find((s) => s.id === id)
      if (!screen) return
      screen.x = Math.round(x)
      screen.y = Math.round(y)
    },
    { coalesce: `move:${id}` }
  )
}

export function deleteScreen(id: string) {
  update((doc) => {
    const owned = new Set(
      doc.modules.filter((m) => m.screenId === id).map((m) => m.id)
    )
    doc.screens = doc.screens.filter((s) => s.id !== id)
    doc.edges = doc.edges.filter((e) => e.from !== id && e.to !== id)
    doc.modules = doc.modules.filter((m) => m.screenId !== id)
    doc.moduleEdges = doc.moduleEdges.filter(
      (e) => !owned.has(e.from) && !owned.has(e.to)
    )
  })
}

export function duplicateScreen(id: string) {
  update((doc) => {
    const source = doc.screens.find((s) => s.id === id)
    if (!source) return
    const copy: Screen = {
      ...structuredClone(source),
      id: uid("scr"),
      key: uniqueKey(
        `${source.key}_copy`,
        doc.screens.map((s) => s.key)
      ),
      title: `${source.title} copy`,
      x: source.x + 40,
      y: source.y + 40,
    }
    doc.screens.push(copy)

    // The modules and their internal wiring come along, remapped onto new ids.
    const idMap = new Map<string, string>()
    for (const module of doc.modules.filter((m) => m.screenId === id)) {
      const nextId = uid("mod")
      idMap.set(module.id, nextId)
      doc.modules.push({
        ...structuredClone(module),
        id: nextId,
        screenId: copy.id,
      })
    }
    for (const edge of doc.moduleEdges) {
      const from = idMap.get(edge.from)
      const to = idMap.get(edge.to)
      if (from && to) doc.moduleEdges.push({ ...edge, id: uid("med"), from, to })
    }
  })
}

export function connectScreens(from: string, to: string, trigger = "") {
  update((doc) => {
    if (from === to) return
    if (edgeExists(doc.edges, from, to)) return
    doc.edges.push({ id: uid("edg"), from, to, trigger, views: [] })
  })
}

export function updateEdge(id: string, trigger: string) {
  update((doc) => {
    const edge = doc.edges.find((e) => e.id === id)
    if (edge) edge.trigger = trigger
  })
}

export function deleteEdge(id: string) {
  update((doc) => {
    doc.edges = doc.edges.filter((e) => e.id !== id)
  })
}

/**
 * Reorders screens on the canvas by dropping one before another in the outline.
 * Flow order itself is derived from the connections, so this rewrites the
 * left-to-right reading order (positions), not the graph.
 */
export function reorderScreens(fromId: string, toIndex: number) {
  update((doc) => {
    const index = doc.screens.findIndex((s) => s.id === fromId)
    if (index === -1 || index === toIndex) return
    const ordered = [...doc.screens]
    const [moved] = ordered.splice(index, 1)
    ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved)

    const slots = [...doc.screens]
      .map((s) => ({ x: s.x, y: s.y }))
      .sort((a, b) => a.x - b.x || a.y - b.y)
    doc.screens = ordered.map((screen, i) => ({ ...screen, ...slots[i] }))
  })
}

/**
 * `heights` comes from the canvas, which is the only place that knows how tall
 * each node currently renders — a screen showing its modules needs a whole
 * column row to itself.
 */
export function arrangeScreens(
  heights?: Record<string, number>,
  options?: { silent?: boolean; only?: string[] }
) {
  update(
    (doc) => {
      // `only` lays out a subset — the screens one role can reach — and leaves
      // the rest where they are. Without it, switching to a view would filter
      // the canvas but keep the whole-app positions, so the role's flow reads
      // as a full-app layout with holes punched in it.
      const only = options?.only ? new Set(options.only) : null
      if (!only) {
        doc.screens = autoLayout(doc.screens, doc.edges, { heights })
        return
      }
      const subset = doc.screens.filter((s) => only.has(s.id))
      const subsetEdges = doc.edges.filter(
        (e) => only.has(e.from) && only.has(e.to)
      )
      const laid = new Map(
        autoLayout(subset, subsetEdges, { heights }).map((s) => [s.id, s])
      )
      doc.screens = doc.screens.map((s) => laid.get(s.id) ?? s)
    },
    // Re-spacing that follows an expand/collapse is a consequence of a view
    // change, so it stays out of the undo stack; pressing Ctrl+Z after opening
    // a screen should undo whatever edit came before it, not the reflow.
    options?.silent ? { silent: true } : undefined
  )
}

/** Move a screen to another build. */
export function setScreenSurface(id: string, surface: Surface) {
  update((doc) => {
    const screen = doc.screens.find((s) => s.id === id)
    if (!screen) return
    const was = screen.surface
    screen.surface = surface

    // A web layout cannot describe a phone screen, and vice versa — carry the
    // choice across to the nearest equivalent rather than leaving a sidebar
    // dashboard sitting on the Mobile tab.
    if (was !== surface && screen.layout) {
      const meta = screenTemplateMap[screen.template]
      screen.layout =
        surface === "mobile"
          ? defaultLayoutFor(screen.layout, "mobile")
          : isMobileLayout(screen.layout)
            ? (meta?.defaultLayout ?? "")
            : screen.layout
    }
    // Its connections to screens that stayed behind are no longer meaningful.
    const sameSurface = new Set(
      doc.screens.filter((s) => s.surface === surface).map((s) => s.id)
    )
    doc.edges = doc.edges.filter(
      (e) => sameSurface.has(e.from) === sameSurface.has(e.to)
    )
  })
}

// ----------------------------------------------------------------- views

export function addView(name = "New view"): string | null {
  let newId: string | null = null
  update((doc) => {
    const view: FlowView = {
      id: uid("vw"),
      key: uniqueKey(
        slugify(name),
        doc.views.map((v) => v.key)
      ),
      name,
      note: "",
    }
    newId = view.id
    doc.views.push(view)
  })
  return newId
}

export function updateView(id: string, patch: Partial<FlowView>) {
  update((doc) => {
    const view = doc.views.find((v) => v.id === id)
    if (!view) return
    if (patch.key) {
      patch.key = uniqueKey(
        slugify(patch.key),
        doc.views.filter((v) => v.id !== id).map((v) => v.key)
      )
    }
    Object.assign(view, patch)
  })
}

export function deleteView(id: string) {
  update((doc) => {
    doc.views = doc.views.filter((v) => v.id !== id)
    // A screen tagged only with the deleted view would otherwise vanish from
    // every view; dropping the tag returns it to "shared".
    for (const screen of doc.screens) {
      screen.views = screen.views.filter((v) => v !== id)
    }
    for (const edge of doc.edges) {
      edge.views = edge.views.filter((v) => v !== id)
    }
  })
}

/** Adds or removes one view tag on a screen. */
export function toggleScreenView(screenId: string, viewId: string) {
  update((doc) => {
    const screen = doc.screens.find((s) => s.id === screenId)
    if (!screen) return
    screen.views = screen.views.includes(viewId)
      ? screen.views.filter((v) => v !== viewId)
      : [...screen.views, viewId]
  })
}

// ----------------------------------------------------------------- flows

/**
 * Flow groups are the *journey* axis, independent of views.
 *
 * Membership is a tag on the screen and nothing else. Nothing here derives a
 * group from the graph: a derived group re-computes the moment an edge is
 * added, which means it changes under the person looking at it and there is no
 * way to say "no, that screen is not part of checkout". A tag can just be
 * removed.
 */
export function addFlow(name = "New flow"): string | null {
  let newId: string | null = null
  update((doc) => {
    const flow: FlowGroup = {
      id: uid("flw"),
      key: uniqueKey(
        slugify(name),
        doc.flows.map((f) => f.key)
      ),
      name,
      story: { role: "", want: "", soThat: "", criteria: [] },
      note: "",
      order: doc.flows.length,
    }
    newId = flow.id
    doc.flows.push(flow)
  })
  return newId
}

export function updateFlow(id: string, patch: Partial<FlowGroup>) {
  update((doc) => {
    const flow = doc.flows.find((f) => f.id === id)
    if (!flow) return
    if (patch.key) {
      patch.key = uniqueKey(
        slugify(patch.key),
        doc.flows.filter((f) => f.id !== id).map((f) => f.key)
      )
    }
    Object.assign(flow, patch)
  })
}

export function deleteFlow(id: string) {
  update((doc) => {
    doc.flows = doc.flows.filter((f) => f.id !== id)
    // The screens stay; they simply become ungrouped, which the flow picker
    // shows rather than hides.
    for (const screen of doc.screens) {
      screen.flows = screen.flows.filter((f) => f !== id)
    }
    doc.flows.forEach((flow, index) => {
      flow.order = index
    })
  })
}

/** Adds or removes one flow tag on a screen. */
export function toggleScreenFlow(screenId: string, flowId: string) {
  update((doc) => {
    const screen = doc.screens.find((s) => s.id === screenId)
    if (!screen) return
    screen.flows = screen.flows.includes(flowId)
      ? screen.flows.filter((f) => f !== flowId)
      : [...screen.flows, flowId]
  })
}

// ---------------------------------------------------------------- stories

/**
 * Patches the story of a screen or a flow, whichever owns `id`.
 *
 * Coalesced per field. A story is the most typing there is anywhere in this
 * app — three sentences and a list of criteria — and without this every
 * keystroke is its own undo step, so one ⌘Z after writing a story rubs out a
 * single character. The key includes the field so moving between them still
 * breaks the run.
 */
export function updateStory(id: string, patch: Partial<UserStory>) {
  const field = Object.keys(patch)[0] ?? "story"
  update(
    (doc) => {
      const owner =
        doc.screens.find((s) => s.id === id) ?? doc.flows.find((f) => f.id === id)
      if (!owner) return
      Object.assign(owner.story, patch)
    },
    { coalesce: `story:${id}:${field}` }
  )
}

export function setCriterion(id: string, index: number, text: string) {
  update(
    (doc) => {
      const owner =
        doc.screens.find((s) => s.id === id) ?? doc.flows.find((f) => f.id === id)
      if (!owner || index < 0 || index >= owner.story.criteria.length) return
      owner.story.criteria[index] = text
    },
    { coalesce: `criterion:${id}:${index}` }
  )
}

export function addCriterion(id: string) {
  update((doc) => {
    const owner =
      doc.screens.find((s) => s.id === id) ?? doc.flows.find((f) => f.id === id)
    if (!owner) return
    owner.story.criteria.push("")
  })
}

export function removeCriterion(id: string, index: number) {
  update((doc) => {
    const owner =
      doc.screens.find((s) => s.id === id) ?? doc.flows.find((f) => f.id === id)
    if (!owner) return
    owner.story.criteria.splice(index, 1)
  })
}

/** True when anything at all has been written — what the canvas marker reads. */
export function hasStory(story: UserStory): boolean {
  return Boolean(
    story.role.trim() ||
      story.want.trim() ||
      story.soThat.trim() ||
      story.criteria.some((c) => c.trim())
  )
}

export function toggleEdgeView(edgeId: string, viewId: string) {
  update((doc) => {
    const edge = doc.edges.find((e) => e.id === edgeId)
    if (!edge) return
    edge.views = edge.views.includes(viewId)
      ? edge.views.filter((v) => v !== viewId)
      : [...edge.views, viewId]
  })
}

// --------------------------------------------------------------- modules

/** Modules of one screen, in their declared order. */
export function modulesOf(doc: ProjectDoc, screenId: string) {
  return doc.modules
    .filter((m) => m.screenId === screenId)
    .sort((a, b) => a.order - b.order)
}

export function addModule(screenId: string, kind = "panel"): string | null {
  let newId: string | null = null
  update((doc) => {
    if (!doc.screens.some((s) => s.id === screenId)) return
    const meta = moduleKindMap[kind]
    const siblings = modulesOf(doc, screenId)
    const name = meta?.name ?? `Module ${siblings.length + 1}`
    const module: ScreenModule = {
      id: uid("mod"),
      screenId,
      // Keys only have to be unique within their screen, so two screens can
      // both have a plain `table` without either being renamed.
      key: uniqueKey(
        slugify(name),
        siblings.map((m) => m.key)
      ),
      name,
      kind,
      trigger: "",
      note: "",
      order: siblings.length,
    }
    newId = module.id
    doc.modules.push(module)
  })
  return newId
}

export function updateModule(id: string, patch: Partial<ScreenModule>) {
  update((doc) => {
    const module = doc.modules.find((m) => m.id === id)
    if (!module) return
    if (patch.key) {
      patch.key = uniqueKey(
        slugify(patch.key),
        doc.modules
          .filter((m) => m.screenId === module.screenId && m.id !== id)
          .map((m) => m.key)
      )
    }
    Object.assign(module, patch)
  })
}

export function deleteModule(id: string) {
  update((doc) => {
    const module = doc.modules.find((m) => m.id === id)
    if (!module) return
    doc.modules = doc.modules.filter((m) => m.id !== id)
    doc.moduleEdges = doc.moduleEdges.filter(
      (e) => e.from !== id && e.to !== id
    )
    // Close the gap so `order` stays dense — renumber in the order the user
    // sees, not in array order, which need not match.
    modulesOf(doc, module.screenId).forEach((sibling, index) => {
      sibling.order = index
    })
  })
}

export function duplicateModule(id: string) {
  update((doc) => {
    const source = doc.modules.find((m) => m.id === id)
    if (!source) return
    const siblings = modulesOf(doc, source.screenId)
    doc.modules.push({
      ...structuredClone(source),
      id: uid("mod"),
      key: uniqueKey(
        `${source.key}_copy`,
        siblings.map((m) => m.key)
      ),
      name: `${source.name} copy`,
      order: siblings.length,
    })
  })
}

export function connectModules(from: string, to: string, trigger = "") {
  update((doc) => {
    if (from === to) return
    const source = doc.modules.find((m) => m.id === from)
    const target = doc.modules.find((m) => m.id === to)
    // A module edge is internal to one screen; anything else belongs on the
    // screen graph and would render as an arrow leaving its own container.
    if (!source || !target || source.screenId !== target.screenId) return
    if (doc.moduleEdges.some((e) => e.from === from && e.to === to)) return
    doc.moduleEdges.push({ id: uid("med"), from, to, trigger })
  })
}

export function updateModuleEdge(id: string, trigger: string) {
  update((doc) => {
    const edge = doc.moduleEdges.find((e) => e.id === id)
    if (edge) edge.trigger = trigger
  })
}

export function deleteModuleEdge(id: string) {
  update((doc) => {
    doc.moduleEdges = doc.moduleEdges.filter((e) => e.id !== id)
  })
}

export function reorderModules(fromId: string, toIndex: number) {
  update((doc) => {
    const module = doc.modules.find((m) => m.id === fromId)
    if (!module) return
    const ordered = modulesOf(doc, module.screenId)
    const index = ordered.findIndex((m) => m.id === fromId)
    if (index === -1) return
    const [moved] = ordered.splice(index, 1)
    ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved)
    ordered.forEach((m, i) => {
      m.order = i
    })
  })
}

// -------------------------------------------------------------- sections

export function addSection(type: string) {
  let newId: string | null = null
  update((doc) => {
    const meta = sectionTypeMap[type]
    const section: Section = {
      id: uid("sec"),
      type,
      name: meta?.name ?? type,
      // Landing sections belong to the web page; no surface mapping applies.
      layout: meta?.defaultLayout ?? "",
      note: "",
      order: doc.sections.length,
    }
    newId = section.id
    doc.sections.push(section)
  })
  return newId
}

export function updateSection(id: string, patch: Partial<Section>) {
  update((doc) => {
    const section = doc.sections.find((s) => s.id === id)
    if (section) Object.assign(section, patch)
  })
}

export function deleteSection(id: string) {
  update((doc) => {
    doc.sections = doc.sections
      .filter((s) => s.id !== id)
      .map((section, index) => ({ ...section, order: index }))
  })
}

export function moveSection(id: string, direction: -1 | 1) {
  update((doc) => {
    const ordered = [...doc.sections].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex((s) => s.id === id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= ordered.length) return
    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)
    doc.sections = ordered.map((section, i) => ({ ...section, order: i }))
  })
}

export function reorderSections(fromId: string, toIndex: number) {
  update((doc) => {
    const ordered = [...doc.sections].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex((s) => s.id === fromId)
    if (index === -1) return
    const [moved] = ordered.splice(index, 1)
    ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved)
    doc.sections = ordered.map((section, i) => ({ ...section, order: i }))
  })
}
