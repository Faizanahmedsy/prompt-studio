import { screenTemplateMap } from "@/features/library/data/templates"
import { sectionTypeMap } from "@/features/library/data/section-types"
import { useProjectStore } from "@/stores/use-project-store"
import { slugify, uid, uniqueKey } from "@/lib/utils"
import type { ProjectDoc, Screen, Section } from "@/types/project"

import { autoLayout, edgeExists } from "./graph"

const update = (
  mutate: (doc: ProjectDoc) => void,
  options?: { coalesce?: string }
) => useProjectStore.getState().update(mutate, options)

export function addScreen(
  template = "",
  position?: { x: number; y: number }
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
      layout: meta?.defaultLayout ?? "",
      note: "",
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
    doc.screens = doc.screens.filter((s) => s.id !== id)
    doc.edges = doc.edges.filter((e) => e.from !== id && e.to !== id)
  })
}

export function duplicateScreen(id: string) {
  update((doc) => {
    const source = doc.screens.find((s) => s.id === id)
    if (!source) return
    doc.screens.push({
      ...structuredClone(source),
      id: uid("scr"),
      key: uniqueKey(
        `${source.key}_copy`,
        doc.screens.map((s) => s.key)
      ),
      title: `${source.title} copy`,
      x: source.x + 40,
      y: source.y + 40,
    })
  })
}

export function connectScreens(from: string, to: string, trigger = "") {
  update((doc) => {
    if (from === to) return
    if (edgeExists(doc.edges, from, to)) return
    doc.edges.push({ id: uid("edg"), from, to, trigger })
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

export function arrangeScreens() {
  update((doc) => {
    doc.screens = autoLayout(doc.screens, doc.edges)
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
