/**
 * The maths behind the discovery rail: how far each module has got, and what
 * order the questions are asked in.
 *
 * Pure functions over the item list rather than a read of `run.progress`,
 * because the run's counts are a snapshot from the server and go stale the
 * moment somebody answers something here. The optimistic UI needs a number it
 * can recompute locally; the server's is what it reconciles to on the next
 * load.
 */

import type { DiscoveryItem } from "@/lib/api/discovery"

/**
 * The bucket for items the run did not tag with a module.
 *
 * They are not dropped: an untagged item would otherwise be answerable through
 * no module in the rail, and therefore invisible — a decision nobody is ever
 * asked. Named rather than blank so it sorts and reads like any other row.
 */
export const UNASSIGNED_MODULE = "general"

export type ModuleRow = {
  name: string
  total: number
  answered: number
}

export type RunCounts = {
  total: number
  answered: number
  needsUser: number
  needsUserAnswered: number
}

export function isAnswered(item: DiscoveryItem): boolean {
  return item.answer !== null
}

/**
 * A root question: nothing has to be decided before it, and it is a question
 * rather than a standing rule.
 *
 * Roots are pinned because they are the ones whose answer changes what the
 * rest of the tree even means — picking multi-tenancy first saves answering
 * forty questions that assume it.
 */
export function isRoot(item: DiscoveryItem): boolean {
  return item.depends_on.length === 0 && item.family !== "RULE"
}

/** The modules an item counts towards — never empty, see `UNASSIGNED_MODULE`. */
export function modulesOf(item: DiscoveryItem): string[] {
  return item.modules.length ? item.modules : [UNASSIGNED_MODULE]
}

export function itemsInModule(items: DiscoveryItem[], module: string): DiscoveryItem[] {
  return items.filter((item) => modulesOf(item).includes(module))
}

/**
 * Answered/total per module, unfinished modules first.
 *
 * An item tagged with two modules counts in both: it is a decision each of
 * them is waiting on, and hiding it from one of the two lists is how a module
 * reads as complete while something it depends on is still open.
 */
export function moduleProgress(items: DiscoveryItem[]): ModuleRow[] {
  const rows = new Map<string, ModuleRow>()
  for (const item of items) {
    for (const name of modulesOf(item)) {
      const row = rows.get(name) ?? { name, total: 0, answered: 0 }
      row.total += 1
      if (isAnswered(item)) row.answered += 1
      rows.set(name, row)
    }
  }
  return [...rows.values()].sort((a, b) => {
    const left = a.total - a.answered
    const right = b.total - b.answered
    // Finished modules sink; among equals, alphabetical, so the list does not
    // reshuffle under the cursor every time an answer lands.
    if ((left === 0) !== (right === 0)) return left === 0 ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

export function runCounts(items: DiscoveryItem[]): RunCounts {
  let answered = 0
  let needsUser = 0
  let needsUserAnswered = 0
  for (const item of items) {
    const done = isAnswered(item)
    if (done) answered += 1
    if (item.needs_user) {
      needsUser += 1
      if (done) needsUserAnswered += 1
    }
  }
  return { total: items.length, answered, needsUser, needsUserAnswered }
}

/**
 * Roots first, then everything else, each block by `position`.
 *
 * `position` alone is the order the run was written in, which interleaves the
 * questions that unlock others with the ones that depend on them. Sorting is
 * stable within a block so two items at the same position keep the run's
 * order rather than swapping between renders.
 */
export function orderItems(items: DiscoveryItem[]): DiscoveryItem[] {
  return [...items].sort((a, b) => {
    const rootA = isRoot(a)
    if (rootA !== isRoot(b)) return rootA ? -1 : 1
    return a.position - b.position
  })
}

/** The items still waiting on an answer, in the same order. */
export function unanswered(items: DiscoveryItem[]): DiscoveryItem[] {
  return orderItems(items).filter((item) => !isAnswered(item))
}

/**
 * Was this answered by taking the proposal rather than by choosing?
 *
 * Matched on `proposed_key` when the item offered options and on the decision
 * text when it did not — "Accept all defaults" writes exactly the proposal, so
 * the two are indistinguishable afterwards except by comparing them.
 */
export function answeredByDefault(item: DiscoveryItem): boolean {
  const answer = item.answer
  if (!answer) return false
  if (item.proposed_key) return answer.choice_key === item.proposed_key
  return item.proposed !== null && answer.decision === item.proposed
}

/**
 * The things this question assumes that nobody actually decided.
 *
 * Answering a dependency by accepting its default is a decision made by not
 * looking, and a question built on top of one is worth flagging — otherwise a
 * bulk accept quietly settles the interesting question three levels down.
 */
export function defaultedDependencies(
  item: DiscoveryItem,
  byKey: Map<string, DiscoveryItem>
): DiscoveryItem[] {
  return item.depends_on
    .map((key) => byKey.get(key))
    .filter((dep): dep is DiscoveryItem => dep !== undefined && answeredByDefault(dep))
}

export function byKey(items: DiscoveryItem[]): Map<string, DiscoveryItem> {
  return new Map(items.map((item) => [item.key, item]))
}

/**
 * The gate's decision grammar: `resolve: <option>` or `waive: <reason>`.
 *
 * An option's `decision` already arrives in the first form, so it is passed
 * through. Free text is a waiver and gets the prefix here rather than the
 * person being asked to type it — except on an item that offered no options at
 * all, where there is nothing to waive and the text *is* the decision.
 *
 * Lives here rather than in the card because it is the wire format, and the one
 * part of answering that is worth a test.
 */
export function waiveDecision(freeText: string, hadOptions: boolean): string {
  const text = freeText.trim()
  if (!text) return ""
  return hadOptions ? `waive: ${stripWaive(text)}` : text
}

/** Undo `waiveDecision`, so re-editing a waiver does not stack prefixes. */
export function stripWaive(text: string): string {
  return text.replace(/^waive:\s*/i, "")
}

/**
 * The artifact tabs, grouped by file name rather than by kind.
 *
 * Grouping by `kind` looked right and was useless: the stored kinds are
 * `md|dbml|mermaid|weave|json|flow`, so the four documents a person actually
 * reads — the inventory, the KB, the features, the issues — all landed in one
 * tab called "md" and had to be found by filename. The names are the contract
 * weaver writes to, so the names are what the tabs key on.
 *
 * Anything unrecognised still gets a tab, at the end: a file nobody can open
 * is a file that may as well not have been written.
 */
export type ArtifactTab = { label: string; names: string[] }

const NAMED_TABS: [label: string, file: string][] = [
  ["Inventory", "discovery/inventory.md"],
  ["KB", "discovery/kb.md"],
  ["Features", "discovery/features.md"],
  ["Issues", "discovery/issues.md"],
  ["Coverage", "discovery/coverage.md"],
]

// The integrations map is the one diagram that describes the whole system, so
// it leads; the per-flow diagrams follow it in name order.
function flowRank(name: string): number {
  if (name === "integrations.mmd") return 0
  return name.startsWith("flow-") ? 1 : 2
}

export function artifactTabs(artifacts: { name: string }[]): ArtifactTab[] {
  const names = artifacts.map((file) => file.name)
  const taken = new Set<string>()
  const tabs: ArtifactTab[] = []
  const add = (label: string, picked: string[]) => {
    if (!picked.length) return
    for (const name of picked) taken.add(name)
    tabs.push({ label, names: picked })
  }

  for (const [label, file] of NAMED_TABS) add(label, names.filter((name) => name === file))
  add(
    "Flows",
    names
      .filter((name) => name.endsWith(".mmd"))
      .sort((a, b) => flowRank(a) - flowRank(b) || a.localeCompare(b))
  )
  add("Schema", names.filter((name) => name === "schema.dbml"))
  add(".weave", names.filter((name) => name === "project.weave"))
  add("Other", names.filter((name) => !taken.has(name)).sort())
  return tabs
}
