import { describe, expect, it } from "vitest"

import {
  answeredByDefault,
  artifactTabs,
  byKey,
  defaultedDependencies,
  isRoot,
  moduleProgress,
  orderItems,
  runCounts,
  stripWaive,
  UNASSIGNED_MODULE,
  unanswered,
  waiveDecision,
} from "@/features/discovery/progress"
import type { DiscoveryItem, ItemAnswer } from "@/lib/api/discovery"

function answer(over: Partial<ItemAnswer> = {}): ItemAnswer {
  return {
    decision: "yes",
    choice_key: null,
    note: "",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  }
}

function item(over: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id: over.key ?? "i1",
    key: "q1",
    family: "QUESTION",
    kind: "decision",
    severity: null,
    title: "A question",
    body: "what: something",
    modules: ["orders"],
    options: [],
    proposed: null,
    proposed_key: null,
    needs_user: false,
    depends_on: [],
    position: 0,
    answer: null,
    ...over,
  }
}

describe("module progress", () => {
  it("counts answered against total per module", () => {
    const rows = moduleProgress([
      item({ key: "a", modules: ["orders"], answer: answer() }),
      item({ key: "b", modules: ["orders"] }),
      item({ key: "c", modules: ["billing"] }),
    ])
    expect(rows).toEqual([
      { name: "billing", total: 1, answered: 0 },
      { name: "orders", total: 2, answered: 1 },
    ])
  })

  it("counts an item tagged with two modules in both", () => {
    // Each module is waiting on that one decision, so it is open in both.
    const rows = moduleProgress([item({ key: "a", modules: ["orders", "billing"] })])
    expect(rows.map((row) => [row.name, row.total])).toEqual([
      ["billing", 1],
      ["orders", 1],
    ])
  })

  it("keeps an untagged item reachable instead of dropping it", () => {
    const rows = moduleProgress([item({ key: "a", modules: [] })])
    expect(rows).toEqual([{ name: UNASSIGNED_MODULE, total: 1, answered: 0 }])
  })

  it("sinks finished modules below the ones with work left", () => {
    const rows = moduleProgress([
      item({ key: "a", modules: ["aaa"], answer: answer() }),
      item({ key: "b", modules: ["zzz"] }),
    ])
    expect(rows.map((row) => row.name)).toEqual(["zzz", "aaa"])
  })

  it("totals the run, and the needs-a-human subset separately", () => {
    expect(
      runCounts([
        item({ key: "a", needs_user: true, answer: answer() }),
        item({ key: "b", needs_user: true }),
        item({ key: "c", answer: answer() }),
      ])
    ).toEqual({ total: 3, answered: 2, needsUser: 2, needsUserAnswered: 1 })
  })
})

describe("ordering", () => {
  it("pins roots above everything, each block by position", () => {
    const order = orderItems([
      item({ key: "dep-late", depends_on: ["root-a"], position: 9 }),
      item({ key: "root-b", position: 5 }),
      item({ key: "dep-early", depends_on: ["root-a"], position: 1 }),
      item({ key: "root-a", position: 2 }),
    ])
    expect(order.map((row) => row.key)).toEqual([
      "root-a",
      "root-b",
      "dep-early",
      "dep-late",
    ])
  })

  it("does not treat a standing rule as a root question", () => {
    expect(isRoot(item({ family: "RULE" }))).toBe(false)
    expect(isRoot(item({ family: "QUESTION" }))).toBe(true)
    expect(isRoot(item({ depends_on: ["other"] }))).toBe(false)
  })

  it("leaves the input array alone", () => {
    const input = [item({ key: "b", position: 2 }), item({ key: "a", position: 1 })]
    orderItems(input)
    expect(input.map((row) => row.key)).toEqual(["b", "a"])
  })

  it("lists only what is still open, in the same order", () => {
    const open = unanswered([
      item({ key: "done", position: 0, answer: answer() }),
      item({ key: "open", position: 1 }),
    ])
    expect(open.map((row) => row.key)).toEqual(["open"])
  })
})

describe("defaults", () => {
  it("recognises an option accepted as proposed", () => {
    expect(
      answeredByDefault(
        item({ proposed_key: "soft", answer: answer({ choice_key: "soft" }) })
      )
    ).toBe(true)
    expect(
      answeredByDefault(
        item({ proposed_key: "soft", answer: answer({ choice_key: "hard" }) })
      )
    ).toBe(false)
  })

  it("falls back to the decision text when the item offered no options", () => {
    expect(
      answeredByDefault(item({ proposed: "keep it", answer: answer({ decision: "keep it" }) }))
    ).toBe(true)
    expect(
      answeredByDefault(item({ proposed: "keep it", answer: answer({ decision: "drop it" }) }))
    ).toBe(false)
  })

  it("is false for anything unanswered, proposal or not", () => {
    expect(answeredByDefault(item({ proposed: "keep it" }))).toBe(false)
  })

  it("names the dependencies that were settled by not looking", () => {
    const items = [
      item({ key: "root", proposed_key: "soft", answer: answer({ choice_key: "soft" }) }),
      item({ key: "chosen", proposed_key: "soft", answer: answer({ choice_key: "hard" }) }),
      item({ key: "child", depends_on: ["root", "chosen", "missing"] }),
    ]
    const child = items[2]
    expect(defaultedDependencies(child, byKey(items)).map((row) => row.key)).toEqual(["root"])
  })
})

describe("the decision grammar", () => {
  it("files free text over offered options as a waiver", () => {
    expect(waiveDecision("  needs legal sign-off ", true)).toBe("waive: needs legal sign-off")
  })

  it("leaves an item that offered nothing to waive alone", () => {
    // There is no option being declined here — the text is the decision.
    expect(waiveDecision("soft delete, 30 days", false)).toBe("soft delete, 30 days")
  })

  it("does not stack a prefix when a waiver is edited again", () => {
    const once = waiveDecision("needs legal sign-off", true)
    expect(waiveDecision(stripWaive(once), true)).toBe(once)
    expect(waiveDecision(once, true)).toBe(once)
  })

  it("is empty for empty text, so the Save button stays disabled", () => {
    expect(waiveDecision("   ", true)).toBe("")
  })
})

/**
 * The tabs used to key on `kind`, and the kinds they named — `inventory`, `kb`,
 * `features`, `issues`, `flows` — are not kinds anything stores. Every document
 * is `md`, so all four landed in one tab and the tab labels matched nothing.
 * The file names are the contract weaver writes to, so these key on those.
 */
describe("artifactTabs", () => {
  const files = (...names: string[]) => names.map((name) => ({ name }))

  it("names the four documents and orders them the way they are read", () => {
    const tabs = artifactTabs(
      files(
        "discovery/issues.md",
        "discovery/kb.md",
        "discovery/features.md",
        "discovery/inventory.md"
      )
    )
    expect(tabs.map((tab) => tab.label)).toEqual(["Inventory", "KB", "Features", "Issues"])
  })

  it("puts every diagram in one Flows tab, the integrations map first", () => {
    const tabs = artifactTabs(
      files("flow-invoice.mmd", "integrations.mmd", "flow-checkout.mmd")
    )
    expect(tabs).toEqual([
      {
        label: "Flows",
        names: ["integrations.mmd", "flow-checkout.mmd", "flow-invoice.mmd"],
      },
    ])
  })

  it("gives the schema and the .weave their own tabs, in that order", () => {
    const tabs = artifactTabs(files("project.weave", "schema.dbml"))
    expect(tabs.map((tab) => tab.label)).toEqual(["Schema", ".weave"])
  })

  it("shows Coverage only when it was written", () => {
    expect(artifactTabs(files("discovery/kb.md")).map((tab) => tab.label)).toEqual(["KB"])
    expect(
      artifactTabs(files("discovery/kb.md", "discovery/coverage.md")).map((tab) => tab.label)
    ).toEqual(["KB", "Coverage"])
  })

  it("keeps anything unrecognised, under Other, at the end", () => {
    const tabs = artifactTabs(files("prototype/seed.json", "schema.flow", "discovery/kb.md"))
    expect(tabs.map((tab) => tab.label)).toEqual(["KB", "Other"])
    expect(tabs[1].names).toEqual(["prototype/seed.json", "schema.flow"])
  })

  it("is empty when nothing was pushed", () => {
    expect(artifactTabs([])).toEqual([])
  })
})
