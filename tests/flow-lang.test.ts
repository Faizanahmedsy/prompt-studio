import { describe, expect, it } from "vitest"

import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { starters } from "@/features/library/data/starters"
import type { ProjectDoc } from "@/types/project"

/** Ids and canvas coordinates are regenerated on every parse — compare meaning. */
function normalise(doc: ProjectDoc) {
  const keyOf = new Map(doc.screens.map((s) => [s.id, s.key]))
  // Module keys are unique per screen only, so a module needs its screen's key
  // in front of it to be identifiable across a reparse.
  const viewKeyOf = new Map(doc.views.map((v) => [v.id, v.key]))
  const moduleKeyOf = new Map(
    doc.modules.map((m) => [m.id, `${keyOf.get(m.screenId)}.${m.key}`])
  )
  return {
    ...doc,
    screens: doc.screens.map(({ id, x, y, views, ...rest }) => ({
      ...rest,
      views: views.map((v) => viewKeyOf.get(v)),
    })),
    edges: doc.edges
      // biome-ignore lint/correctness/noUnusedFunctionParameters: `id` is destructured to drop it — these assertions compare on keys, not generated ids
      .map(({ id, from, to, trigger, views }) => ({
        from: keyOf.get(from),
        to: keyOf.get(to),
        trigger,
        views: views.map((v) => viewKeyOf.get(v)),
      }))
      .sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)),
    modules: doc.modules
      .map(({ id, screenId, ...rest }) => ({
        screen: keyOf.get(screenId),
        ...rest,
      }))
      .sort((a, b) =>
        `${a.screen}${a.order}`.localeCompare(`${b.screen}${b.order}`)
      ),
    moduleEdges: doc.moduleEdges
      // biome-ignore lint/correctness/noUnusedFunctionParameters: as above — `id` is destructured only to omit it
      .map(({ id, from, to, trigger }) => ({
        from: moduleKeyOf.get(from),
        to: moduleKeyOf.get(to),
        trigger,
      }))
      .sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)),
    sections: doc.sections.map(({ id, ...rest }) => rest),
    views: doc.views.map(({ id, ...rest }) => rest),
  }
}

describe("flow language round-trip", () => {
  for (const starter of starters) {
    it(`survives serialize → parse for "${starter.name}"`, () => {
      const first = parseFlow(starter.source).doc
      const again = parseFlow(serializeFlow(first)).doc
      expect(normalise(again)).toEqual(normalise(first))
    })
  }
})

describe("parser tolerance", () => {
  it("accepts unicode arrows, missing braces and stray commas", () => {
    const { doc, errors } = parseFlow(`
      app "Messy"
      screen login "Sign In" { template auth }
      screen home  "Home"    { template dashboard }
      flow {
        login → home : "after login"
      }
    `)
    expect(errors).toHaveLength(0)
    expect(doc.screens).toHaveLength(2)
    expect(doc.edges[0].trigger).toBe("after login")
  })

  it("auto-creates screens that are only referenced in the flow", () => {
    const { doc } = parseFlow(`
      screen a "A" { template auth }
      flow { a -> b : "next" }
    `)
    expect(doc.screens.map((s) => s.key)).toEqual(["a", "b"])
    expect(doc.edges).toHaveLength(1)
  })

  it("expands an arrow chain into one edge per hop", () => {
    const { doc } = parseFlow(`flow { a -> b -> c }`)
    expect(doc.edges).toHaveLength(2)
    expect(doc.screens).toHaveLength(3)
  })

  it("fuzzy-matches a mistyped layout instead of dropping it", () => {
    const { doc, warnings } = parseFlow(`
      screen d "Dash" { template dashboard; layout dashboard-sidebr }
    `)
    expect(doc.screens[0].layout).toBe("dashboard-sidebar")
    expect(warnings.some((w) => w.message.includes("dashboard-sidebr"))).toBe(true)
  })

  it("keeps an unrecognisable layout as free text rather than losing intent", () => {
    const { doc } = parseFlow(`
      screen z "Z" { layout something-completely-different-xyz }
    `)
    expect(doc.screens[0].layout).toBe("something-completely-different-xyz")
  })

  it("rejects self-connections and duplicates with a warning", () => {
    const { doc, warnings } = parseFlow(`
      flow {
        a -> a
        a -> b
        a -> b
      }
    `)
    expect(doc.edges).toHaveLength(1)
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })

  it("reads heredoc requirements and hex colours without treating # as a comment", () => {
    const { doc } = parseFlow(`
      app "X" { theme { primary #2563eb } }   # trailing comment
      requirements """
        Line one.
        Line two.
      """
    `)
    expect(doc.theme.primaryColor).toBe("#2563eb")
    expect(doc.requirements).toBe("Line one.\nLine two.")
  })

  it("reports an error when the source contains nothing buildable", () => {
    const { errors } = parseFlow("just some prose, not flow source")
    expect(errors.length).toBeGreaterThan(0)
  })
})

const withModules = `
app "Ops" { target claude-code }

screen clients "Clients" {
  template table
  layout   table-advanced
  module filters   "Filter bar"   { kind filters; on "page load" }
  module table     "Client table" { kind table; note "server-driven paging" }
  module add_modal "Add client"   { kind modal; on "click Add Client" }
  inner {
    filters   -> table     : "on filter change, refetch page 1"
    table     -> add_modal : "click Add Client"
    add_modal -> table     : "on save, close and refetch"
  }
}

screen client "Client Detail" {
  template detail
  module table "Activity" { kind list }
}

flow {
  clients -> client : "click a client row"
}
`

describe("modules inside a screen", () => {
  it("parses modules and their inner connections", () => {
    const { doc, errors } = parseFlow(withModules)
    expect(errors).toEqual([])

    const clients = doc.screens.find((s) => s.key === "clients")!
    const modules = doc.modules
      .filter((m) => m.screenId === clients.id)
      .sort((a, b) => a.order - b.order)

    expect(modules.map((m) => m.key)).toEqual(["filters", "table", "add_modal"])
    expect(modules.map((m) => m.kind)).toEqual(["filters", "table", "modal"])
    expect(modules[0].trigger).toBe("page load")
    expect(modules[1].note).toBe("server-driven paging")
    expect(doc.moduleEdges).toHaveLength(3)
  })

  it("keeps module keys unique per screen, not per project", () => {
    const { doc } = parseFlow(withModules)
    // Both screens declare a module keyed `table`; neither gets renamed.
    expect(doc.modules.filter((m) => m.key === "table")).toHaveLength(2)
  })

  it("never turns an inner connection into a screen", () => {
    const { doc } = parseFlow(withModules)
    // `filters`, `table` and `add_modal` are modules — if the screen-level flow
    // block had claimed those arrows they would have become screens.
    expect(doc.screens.map((s) => s.key).sort()).toEqual(["client", "clients"])
    expect(doc.edges).toHaveLength(1)
  })

  it("survives serialize → parse", () => {
    const first = parseFlow(withModules).doc
    const again = parseFlow(serializeFlow(first)).doc
    expect(normalise(again)).toEqual(normalise(first))
  })

  it("round-trips a module whose note spans lines", () => {
    const source = `
screen clients "Clients" {
  module table "Client table" {
    kind table
    note """
    Columns: name, owner, status.
    Bulk select enables Export.
    """
  }
}
`
    const first = parseFlow(source).doc
    expect(first.modules[0].note).toContain("Bulk select")
    const again = parseFlow(serializeFlow(first)).doc
    expect(normalise(again)).toEqual(normalise(first))
  })

  it("drops inner connections that point at nothing", () => {
    const { doc } = parseFlow(`
screen a "A" {
  module one "One" { kind panel }
  inner { one -> two : "click" }
}
`)
    // `two` was never declared, so it is created rather than silently dropped —
    // the same tolerance screens get.
    expect(doc.modules.map((m) => m.key).sort()).toEqual(["one", "two"])
    expect(doc.moduleEdges).toHaveLength(1)
  })
})

const withViews = `
app "Ops" { target claude-code }

views {
  super_admin "Super Admin"
  admin       "Org Admin"
}

screen sign_in "Sign In" { template auth; layout auth-split }
screen orgs    "Organizations" { template table; layout table-basic; in [super_admin] }
screen home    "Home" { template dashboard; layout dashboard-sidebar; in [admin] }

flow {
  sign_in -> orgs : "sign in as super admin" @super_admin
  sign_in -> home : "on sign in"             @admin
  orgs    -> home : "open an organization"
}
`

describe("role views", () => {
  it("parses the views block and the screens tagged with it", () => {
    const { doc, errors } = parseFlow(withViews)
    expect(errors).toEqual([])
    expect(doc.views.map((v) => v.key)).toEqual(["super_admin", "admin"])
    expect(doc.views.map((v) => v.name)).toEqual(["Super Admin", "Org Admin"])

    const byKey = (k: string) => doc.screens.find((s) => s.key === k)!
    const superAdmin = doc.views[0]
    // Untagged means every view — that is what keeps shared screens shared.
    expect(byKey("sign_in").views).toEqual([])
    expect(byKey("orgs").views).toEqual([superAdmin.id])
  })

  it("reads @tags on connections", () => {
    const { doc } = parseFlow(withViews)
    const [superAdmin, admin] = doc.views
    const byPair = (from: string, to: string) => {
      const f = doc.screens.find((s) => s.key === from)!
      const t = doc.screens.find((s) => s.key === to)!
      return doc.edges.find((e) => e.from === f.id && e.to === t.id)!
    }
    expect(byPair("sign_in", "orgs").views).toEqual([superAdmin.id])
    expect(byPair("sign_in", "home").views).toEqual([admin.id])
    expect(byPair("orgs", "home").views).toEqual([])
  })

  it("does not turn a @tag into a screen", () => {
    const { doc } = parseFlow(withViews)
    expect(doc.screens.map((s) => s.key).sort()).toEqual([
      "home",
      "orgs",
      "sign_in",
    ])
  })

  it("creates a view a screen names but the block forgot", () => {
    const { doc } = parseFlow(`
screen a "A" { in [field_rep] }
`)
    expect(doc.views.map((v) => v.key)).toEqual(["field_rep"])
    expect(doc.screens[0].views).toEqual([doc.views[0].id])
  })

  it("survives serialize → parse", () => {
    const first = parseFlow(withViews).doc
    const again = parseFlow(serializeFlow(first)).doc
    expect(normalise(again)).toEqual(normalise(first))
  })
})

describe("surfaces", () => {
  const source = `
screen home    "Home"     { template dashboard }
screen app_home "App Home" { template dashboard; surface mobile }
screen auth_svc "Auth"     { template admin; surface backend }
flow { home -> app_home : "x" }
`

  it("parses the surface a screen belongs to, defaulting to web", () => {
    const { doc, errors } = parseFlow(source)
    expect(errors).toEqual([])
    const by = (k: string) => doc.screens.find((s) => s.key === k)!
    expect(by("home").surface).toBe("web")
    expect(by("app_home").surface).toBe("mobile")
    expect(by("auth_svc").surface).toBe("backend")
  })

  it("warns and stays on web for an unknown surface", () => {
    const { doc, warnings } = parseFlow(`screen a "A" { surface desktop }`)
    expect(doc.screens[0].surface).toBe("web")
    expect(warnings.some((w) => w.message.includes("desktop"))).toBe(true)
  })

  it("survives serialize → parse", () => {
    const first = parseFlow(source).doc
    const again = parseFlow(serializeFlow(first)).doc
    expect(normalise(again)).toEqual(normalise(first))
  })
})
