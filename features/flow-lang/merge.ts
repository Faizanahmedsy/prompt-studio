import { uid } from "@/lib/utils"
import type { ProjectDoc } from "@/types/project"

export type MergeReport = {
  newScreens: number
  updatedScreens: number
  newModules: number
  newEdges: number
  newInnerEdges: number
  newSections: number
}

/**
 * Grafts a parsed fragment onto an existing document, matching screens by key.
 *
 * Blind concatenation — the previous behaviour — cannot work for fragments: a
 * fragment that adds a modal to `clients` would produce a second `clients`
 * screen, and its `flow` edges reference the incoming screen's ids, so they
 * would point at the copy rather than the real one. Matching by key and
 * remapping every incoming id onto the resolved screen is what makes "give me
 * a chunk I can paste into the diagram I already have" work at all.
 *
 * Existing fields are never overwritten. A fragment declares `screen clients {`
 * with only the new modules inside it; anything it leaves out is deliberately
 * absent, not deliberately blank, so absent means "leave alone".
 */
export function mergeDoc(doc: ProjectDoc, incoming: ProjectDoc): MergeReport {
  const report: MergeReport = {
    newScreens: 0,
    updatedScreens: 0,
    newModules: 0,
    newEdges: 0,
    newInnerEdges: 0,
    newSections: 0,
  }

  const byKey = new Map(doc.screens.map((s) => [s.key, s]))
  /** incoming screen id → id in `doc` */
  const screenIds = new Map<string, string>()

  for (const incomingScreen of incoming.screens) {
    const existing = byKey.get(incomingScreen.key)
    if (existing) {
      screenIds.set(incomingScreen.id, existing.id)
      // Only fill blanks. A fragment that omits `layout` is not asking for the
      // layout to be cleared.
      let touched = false
      if (!existing.template && incomingScreen.template) {
        existing.template = incomingScreen.template
        touched = true
      }
      if (!existing.layout && incomingScreen.layout) {
        existing.layout = incomingScreen.layout
        touched = true
      }
      if (!existing.note.trim() && incomingScreen.note.trim()) {
        existing.note = incomingScreen.note
        touched = true
      }
      if (touched) report.updatedScreens += 1
      continue
    }

    // New screen. Its incoming coordinates come from the fragment's own
    // auto-layout, which knows nothing about this canvas, so drop it below
    // everything that already exists rather than on top of it.
    const below = doc.screens.length
      ? Math.max(...doc.screens.map((s) => s.y)) + 260
      : 80
    const screen = {
      ...incomingScreen,
      id: uid("scr"),
      y: below + incomingScreen.y,
    }
    screenIds.set(incomingScreen.id, screen.id)
    byKey.set(screen.key, screen)
    doc.screens.push(screen)
    report.newScreens += 1
  }

  // ------------------------------------------------------------- modules
  /** incoming module id → id in `doc` */
  const moduleIds = new Map<string, string>()

  for (const incomingModule of [...incoming.modules].sort(
    (a, b) => a.order - b.order
  )) {
    const screenId = screenIds.get(incomingModule.screenId)
    if (!screenId) continue
    const siblings = doc.modules.filter((m) => m.screenId === screenId)
    const existing = siblings.find((m) => m.key === incomingModule.key)
    if (existing) {
      moduleIds.set(incomingModule.id, existing.id)
      continue
    }
    const module = {
      ...incomingModule,
      id: uid("mod"),
      screenId,
      order: siblings.length,
    }
    moduleIds.set(incomingModule.id, module.id)
    doc.modules.push(module)
    report.newModules += 1
  }

  // --------------------------------------------------------------- edges
  for (const edge of incoming.edges) {
    const from = screenIds.get(edge.from)
    const to = screenIds.get(edge.to)
    if (!from || !to || from === to) continue
    if (doc.edges.some((e) => e.from === from && e.to === to)) continue
    doc.edges.push({
      id: uid("edg"),
      from,
      to,
      trigger: edge.trigger,
      views: edge.views,
    })
    report.newEdges += 1
  }

  for (const edge of incoming.moduleEdges) {
    const from = moduleIds.get(edge.from)
    const to = moduleIds.get(edge.to)
    if (!from || !to || from === to) continue
    if (doc.moduleEdges.some((e) => e.from === from && e.to === to)) continue
    doc.moduleEdges.push({ id: uid("med"), from, to, trigger: edge.trigger })
    report.newInnerEdges += 1
  }

  // ------------------------------------------------------------ sections
  for (const section of incoming.sections) {
    if (doc.sections.some((s) => s.type === section.type && s.name === section.name)) {
      continue
    }
    doc.sections.push({
      ...section,
      id: uid("sec"),
      order: doc.sections.length,
    })
    report.newSections += 1
  }

  return report
}

export function describeMerge(report: MergeReport): string {
  const parts = [
    report.newScreens && `${report.newScreens} new screen${plural(report.newScreens)}`,
    report.updatedScreens && `${report.updatedScreens} updated`,
    report.newModules && `${report.newModules} module${plural(report.newModules)}`,
    report.newEdges && `${report.newEdges} connection${plural(report.newEdges)}`,
    report.newInnerEdges &&
      `${report.newInnerEdges} inner connection${plural(report.newInnerEdges)}`,
    report.newSections && `${report.newSections} section${plural(report.newSections)}`,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : "Nothing new — the project already had all of it"
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
