import type { FlowEdge, ProjectDoc, Screen } from "@/types/project"

/** The bucket for screens carrying no journey tag. */
export const UNGROUPED = "ungrouped"

/**
 * Which screens and transitions belong to one journey.
 *
 * The rule is the **opposite** of the one views use, deliberately. An untagged
 * screen belongs to *every* view, because "Sign In is shared" is the common and
 * correct case. An untagged screen belongs to *no* journey, because a screen
 * nobody has said the purpose of is a gap worth seeing, not a screen that
 * quietly belongs everywhere.
 */
export function inFlow(tagged: { flows: string[] }, flowId: string | null) {
  if (!flowId) return true
  if (flowId === UNGROUPED) return tagged.flows.length === 0
  return tagged.flows.includes(flowId)
}

export function screensInFlow(doc: ProjectDoc, flowId: string | null): Screen[] {
  return doc.screens.filter((screen) => inFlow(screen, flowId))
}

/**
 * A journey's transitions: those with **both ends inside it**.
 *
 * An edge leaving the journey is where it hands over to another part of the
 * app, and drawing it would pull in a screen the reader did not ask to see.
 */
export function edgesInFlow(doc: ProjectDoc, flowId: string | null): FlowEdge[] {
  if (!flowId) return doc.edges
  const inside = new Set(screensInFlow(doc, flowId).map((s) => s.id))
  return doc.edges.filter((edge) => inside.has(edge.from) && inside.has(edge.to))
}

/** Human list of the journeys a screen is in, for the inspector and the prompt. */
export function flowNames(doc: ProjectDoc, ids: string[]): string[] {
  return ids
    .map((id) => doc.flows.find((f) => f.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

/**
 * How many screens sit in each journey, plus the ungrouped count.
 *
 * Counted over the screens actually on the canvas rather than the whole
 * document, so the number beside a journey matches what picking it will show —
 * a journey whose screens are all on another build reads as empty here, which
 * is the truth for this surface.
 */
export function flowCounts(surfaceScreens: Screen[]) {
  const counts = new Map<string, number>()
  let ungrouped = 0
  for (const screen of surfaceScreens) {
    if (!screen.flows.length) ungrouped += 1
    for (const id of screen.flows) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return { counts, ungrouped }
}
