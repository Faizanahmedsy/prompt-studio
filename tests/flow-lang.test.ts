import { describe, expect, it } from "vitest"

import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { starterDoc, starters } from "@/features/library/data/starters"
import { uiLevelOf } from "@/features/theme/data/ui-levels"
import type { ProjectDoc } from "@/types/project"

/** Ids and canvas coordinates are regenerated on every parse — compare meaning. */
function normalise(doc: ProjectDoc) {
  const keyOf = new Map(doc.screens.map((s) => [s.id, s.key]))
  // Module keys are unique per screen only, so a module needs its screen's key
  // in front of it to be identifiable across a reparse.
  const viewKeyOf = new Map(doc.views.map((v) => [v.id, v.key]))
  const flowKeyOf = new Map(doc.flows.map((f) => [f.id, f.key]))
  const entityKeyOf = new Map(doc.entities.map((e) => [e.id, e.key]))
  const moduleKeyOf = new Map(
    doc.modules.map((m) => [m.id, `${keyOf.get(m.screenId)}.${m.key}`])
  )
  // `creativity` is the retired 0–10 dial. The serializer no longer writes it,
  // so a file that carried one loses it on the way out — deliberately: the
  // value it fed (`uiLevel`) is written instead, and keeping both would leave
  // two settings in the file that can disagree.
  const { creativity: _legacyCreativity, ...rest_ } = doc
  return {
    ...rest_,
    // `uiLevel: null` means "the file never said", and the serializer writes
    // the effective level explicitly. Compare what the document actually
    // means, not whether it had been spelled out yet.
    uiLevel: uiLevelOf(doc),
    screens: doc.screens.map(({ id, x, y, views, flows, ...rest }) => ({
      ...rest,
      views: views.map((v) => viewKeyOf.get(v)),
      flows: flows.map((f) => flowKeyOf.get(f)),
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
    entities: doc.entities.map(({ id, x, y, fields, ...rest }) => ({
      ...rest,
      fields: fields.map(({ id: fieldId, ...field }) => field),
    })),
    relations: doc.relations
      .map(({ id, from, to, ...rest }) => ({
        from: entityKeyOf.get(from),
        to: entityKeyOf.get(to),
        ...rest,
      }))
      .sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)),
    views: doc.views.map(({ id, ...rest }) => rest),
    flows: doc.flows.map(({ id, ...rest }) => rest),
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

describe("user stories", () => {
  const source = `
app "Storied"

flows {
  flow auth "Authentication" {
    note "covers recovery too"
    story {
      as     "a returning user who has forgotten their password"
      want   "get back in without contacting support"
      so     "I am not blocked for a day"
      accept [
        "a reset link expires 30 minutes after it is issued"
        "using a link twice fails with an explanation"
      ]
    }
  }
  flow onboarding "First run" {}
}

screen login "Sign In" {
  template auth
  flows [auth, onboarding]
  story {
    as     "a signed-out user"
    want   "sign in with my email and password"
    so     "I can reach my work"
    accept [
      "a wrong password says so without saying which field was wrong"
      "the submit button is disabled until both fields are filled"
    ]
  }
}

screen home "Home" {
  template dashboard
  flows [onboarding]
}

flow { login -> home : "on successful login" }
`

  it("reads a story block on a screen", () => {
    const { doc, errors } = parseFlow(source)
    expect(errors).toEqual([])
    const login = doc.screens.find((s) => s.key === "login")!
    expect(login.story.role).toBe("a signed-out user")
    expect(login.story.want).toBe("sign in with my email and password")
    expect(login.story.soThat).toBe("I can reach my work")
    expect(login.story.criteria).toHaveLength(2)
    expect(login.story.criteria[1]).toContain("disabled until both fields")
  })

  it("reads flow groups and their stories", () => {
    const { doc } = parseFlow(source)
    expect(doc.flows.map((f) => f.key)).toEqual(["auth", "onboarding"])
    const auth = doc.flows[0]
    expect(auth.name).toBe("Authentication")
    expect(auth.note).toBe("covers recovery too")
    expect(auth.story.want).toBe("get back in without contacting support")
    expect(auth.story.criteria).toHaveLength(2)
  })

  it("tags screens into flows, and one screen into several", () => {
    const { doc } = parseFlow(source)
    const keyOf = new Map(doc.flows.map((f) => [f.id, f.key]))
    const tags = (key: string) =>
      doc.screens.find((s) => s.key === key)!.flows.map((id) => keyOf.get(id))
    expect(tags("login")).toEqual(["auth", "onboarding"])
    expect(tags("home")).toEqual(["onboarding"])
  })

  it("survives serialize → parse", () => {
    const first = parseFlow(source).doc
    const again = parseFlow(serializeFlow(first)).doc
    expect(normalise(again)).toEqual(normalise(first))
  })

  it("does not mistake an arrow inside a criterion for a transition", () => {
    const { doc } = parseFlow(`
      screen a "A" {
        story { accept ["login -> dashboard happens without a full reload"] }
      }
      screen b "B" {}
      flow { a -> b : "next" }
    `)
    expect(doc.edges).toHaveLength(1)
    expect(doc.screens.map((s) => s.key)).toEqual(["a", "b"])
    expect(doc.screens[0].story.criteria[0]).toContain("without a full reload")
  })

  it("accepts the one-line sentence form", () => {
    const { doc } = parseFlow(
      `screen a "A" { story "As an admin I want to export a report, so that finance can reconcile it" }`
    )
    const story = doc.screens[0].story
    expect(story.role).toBe("admin")
    expect(story.want).toBe("export a report")
    expect(story.soThat).toBe("finance can reconcile it")
  })

  it("strips the lead-in a model repeats back", () => {
    const { doc } = parseFlow(`
      screen a "A" {
        story {
          as   "As a billing admin"
          want "I want to refund a charge"
          so   "so that the customer is not chased"
        }
      }
    `)
    const story = doc.screens[0].story
    expect(story.role).toBe("billing admin")
    expect(story.want).toBe("refund a charge")
    expect(story.soThat).toBe("the customer is not chased")
  })

  it("creates a flow named by a tag but never declared", () => {
    const { doc } = parseFlow(`screen a "A" { flows [checkout] }`)
    expect(doc.flows.map((f) => f.key)).toEqual(["checkout"])
    expect(doc.flows[0].name).toBe("Checkout")
    expect(doc.screens[0].flows).toEqual([doc.flows[0].id])
  })

  it("tolerates a model that lists screens inside the flow instead", () => {
    const { doc } = parseFlow(`
      flows { flow auth "Authentication" { screens [login, forgot] } }
      screen login  "Sign In" {}
      screen forgot "Forgot"  {}
    `)
    const auth = doc.flows[0]
    expect(doc.screens.every((s) => s.flows.includes(auth.id))).toBe(true)
  })

  it("leaves a project with no stories exactly as it was", () => {
    const { doc } = parseFlow(`screen a "A" { template auth }`)
    expect(doc.flows).toEqual([])
    expect(doc.screens[0].flows).toEqual([])
    expect(doc.screens[0].story).toEqual({
      role: "",
      want: "",
      soThat: "",
      criteria: [],
    })
    expect(serializeFlow(doc)).not.toContain("story")
  })
})

describe("the starters demonstrate the feature they teach", () => {
  const real = starters.filter((s) => s.id !== "blank")

  for (const starter of real) {
    it(`"${starter.name}" groups its screens into journeys`, () => {
      const { doc, errors } = parseFlow(starter.source)
      expect(errors).toEqual([])
      expect(doc.flows.length).toBeGreaterThan(0)

      // Every screen tagged: an untagged one would sit in the Ungrouped bucket
      // of a starter, which is the app teaching that the tag is optional.
      const untagged = doc.screens.filter((s) => !s.flows.length)
      expect(untagged.map((s) => s.key)).toEqual([])
    })

    it(`"${starter.name}" gives every journey a story`, () => {
      const { doc } = parseFlow(starter.source)
      for (const flow of doc.flows) {
        expect(flow.story.want.trim(), `${flow.key} has no story`).not.toBe("")
      }
    })
  }
})

describe("the theme survives a round trip", () => {
  const themed = {
    designLanguage: "bold-graphic",
    primaryColor: "#ff0000",
    secondaryColor: "#00ff00",
    borderRadius: "full",
    buttonStyle: "outlined",
    density: "spacious",
    headingFont: "slab",
    bodyFont: "humanist",
    typeScale: "expressive",
    iconStyle: "duotone",
    elevation: "layered",
    motion: "none",
    colorScheme: "dark-first",
  } as const

  it("writes every field and reads every field back", () => {
    // The seven settings added with stories and journeys were written by
    // neither end: the serializer skipped them and the parser warned about
    // them. Copy Flow / Paste Flow quietly reset a project's typography,
    // elevation, motion and dark-mode choice to the defaults.
    const doc = { ...starterDoc("saas-dashboard")!, theme: { ...themed } }
    const source = serializeFlow(doc)
    const parsed = parseFlow(source)
    expect(parsed.errors).toEqual([])
    expect(parsed.doc.theme).toEqual(themed)
  })

  it("keeps the current value and says so when a theme word is not recognised", () => {
    const parsed = parseFlow(
      'app "X" {\n  theme {\n    motion interpretive-dance\n  }\n}\n'
    )
    expect(parsed.doc.theme.motion).toBe("restrained")
    expect(parsed.warnings.map((issue) => issue.message).join(" ")).toContain(
      "interpretive-dance"
    )
  })

  it("does not warn about the fields it now understands", () => {
    const source = serializeFlow({ ...starterDoc("saas-dashboard")!, theme: { ...themed } })
    const messages = parseFlow(source).warnings.map((issue) => issue.message)
    expect(messages.filter((message) => message.includes("Unknown theme property"))).toEqual([])
  })
})
