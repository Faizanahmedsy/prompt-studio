import { describe, expect, it } from "vitest"

import { mergeDoc } from "@/features/flow-lang/merge"
import { autoLayout } from "@/features/builder/utils/graph"
import { edgesInView, screensInView } from "@/features/builder/utils/views"
import { parseFlow } from "@/features/flow-lang/parser"
import type { ProjectDoc } from "@/types/project"

const base = () =>
  parseFlow(`
app "Ops" { target claude-code }

screen login   "Sign In"   { template auth }
screen clients "Clients"   {
  template table
  layout   table-advanced
  module table "Client table" { kind table }
}

flow { login -> clients : "on successful login" }
`).doc

const parse = (source: string) => parseFlow(source).doc

/** The screen a fragment claims to attach to, resolved by key. */
const screenByKey = (doc: ProjectDoc, key: string) =>
  doc.screens.find((s) => s.key === key)!

describe("merging a fragment into an existing project", () => {
  it("attaches to an existing screen by key instead of duplicating it", () => {
    const doc = base()
    const report = mergeDoc(
      doc,
      parse(`
screen clients {
  module export_menu "Export" { kind action; on "click Export" }
}
`)
    )

    expect(doc.screens.filter((s) => s.key === "clients")).toHaveLength(1)
    expect(report.newScreens).toBe(0)
    expect(report.newModules).toBe(1)

    const clients = screenByKey(doc, "clients")
    const keys = doc.modules
      .filter((m) => m.screenId === clients.id)
      .map((m) => m.key)
      .sort()
    expect(keys).toEqual(["export_menu", "table"])
  })

  it("wires a fragment's edges onto the real screens, not to copies", () => {
    const doc = base()
    mergeDoc(
      doc,
      parse(`
screen invoice_new "New Invoice" { template form }
flow {
  clients -> invoice_new : "click New Invoice"
  invoice_new -> clients : "on send"
}
`)
    )

    const clients = screenByKey(doc, "clients")
    const invoice = screenByKey(doc, "invoice_new")
    const pairs = doc.edges.map((e) => `${e.from}->${e.to}`)

    expect(pairs).toContain(`${clients.id}->${invoice.id}`)
    expect(pairs).toContain(`${invoice.id}->${clients.id}`)
    // Every edge resolves to a screen that is actually in the document.
    const ids = new Set(doc.screens.map((s) => s.id))
    expect(doc.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true)
  })

  it("does not overwrite fields the fragment leaves out", () => {
    const doc = base()
    mergeDoc(
      doc,
      parse(`
screen clients {
  module export_menu "Export" { kind action }
}
`)
    )
    const clients = screenByKey(doc, "clients")
    // The fragment declared no template or layout; the originals survive.
    expect(clients.template).toBe("table")
    expect(clients.layout).toBe("table-advanced")
  })

  it("fills a field that was blank, and counts the screen as updated", () => {
    const doc = base()
    // `login` was declared with a template but no note, so the note is the
    // blank the fragment is allowed to fill. Its layout is NOT blank — the
    // parser defaulted it from the template — so it must survive untouched.
    const before = screenByKey(doc, "login").layout
    const report = mergeDoc(
      doc,
      parse(`screen login "Sign In" { layout auth-split; note "email + OTP" }`)
    )
    const login = screenByKey(doc, "login")
    expect(login.note).toBe("email + OTP")
    expect(login.layout).toBe(before)
    expect(report.updatedScreens).toBe(1)
  })

  it("is idempotent — merging the same fragment twice adds nothing new", () => {
    const doc = base()
    const fragment = `
screen clients {
  module export_menu "Export" { kind action }
  inner { table -> export_menu : "select rows" }
}
flow { clients -> login : "sign out" }
`
    const first = mergeDoc(doc, parse(fragment))
    const second = mergeDoc(doc, parse(fragment))

    expect(first.newModules).toBe(1)
    expect(first.newEdges).toBe(1)
    expect(first.newInnerEdges).toBe(1)

    expect(second.newScreens).toBe(0)
    expect(second.newModules).toBe(0)
    expect(second.newEdges).toBe(0)
    expect(second.newInnerEdges).toBe(0)
  })

  it("keeps module keys scoped per screen when merging", () => {
    const doc = base()
    mergeDoc(
      doc,
      parse(`
screen login {
  module table "Recent logins" { kind table }
}
`)
    )
    // `clients` already had a `table`; `login` gets its own, unrenamed.
    expect(doc.modules.filter((m) => m.key === "table")).toHaveLength(2)
    const login = screenByKey(doc, "login")
    expect(
      doc.modules.find((m) => m.screenId === login.id)?.name
    ).toBe("Recent logins")
  })

  it("places a new screen clear of the existing ones", () => {
    const doc = base()
    const lowest = Math.max(...doc.screens.map((s) => s.y))
    mergeDoc(doc, parse(`screen reports "Reports" { template dashboard }`))
    expect(screenByKey(doc, "reports").y).toBeGreaterThan(lowest)
  })
})

describe("view filtering", () => {
  const roleDoc = () =>
    parseFlow(`
views { super_admin "Super Admin"; admin "Org Admin" }
screen sign_in "Sign In" { template auth }
screen orgs    "Organizations" { template table; in [super_admin] }
screen home    "Home" { template dashboard; in [admin] }
flow {
  sign_in -> orgs : "as super admin" @super_admin
  sign_in -> home : "on sign in"     @admin
}
`).doc

  it("shows shared screens in every view and restricted ones in only theirs", () => {
    const doc = roleDoc()
    const [superAdmin, admin] = doc.views
    expect(screensInView(doc, superAdmin.id).map((s) => s.key).sort()).toEqual([
      "orgs",
      "sign_in",
    ])
    expect(screensInView(doc, admin.id).map((s) => s.key).sort()).toEqual([
      "home",
      "sign_in",
    ])
    expect(screensInView(doc, null)).toHaveLength(3)
  })

  it("drops a connection whose other end this role cannot reach", () => {
    const doc = roleDoc()
    const [superAdmin] = doc.views
    // The admin-only edge is tagged @admin AND lands on a screen super admin
    // cannot see — either test alone would let it through.
    expect(edgesInView(doc, superAdmin.id)).toHaveLength(1)
    expect(edgesInView(doc, null)).toHaveLength(2)
  })
})

describe("laying out one view's screens", () => {
  it("re-spaces only the visible subset and leaves the rest alone", () => {
    const doc = parseFlow(`
screen a "A" { template auth }
screen b "B" { template table }
screen c "C" { template table }
flow { a -> b : "x"; b -> c : "y" }
`).doc
    // Push everything somewhere arbitrary first.
    for (const s of doc.screens) {
      s.x = 5000
      s.y = 5000
    }
    const hidden = doc.screens.find((s) => s.key === "c")!
    const visible = doc.screens.filter((s) => s.key !== "c")

    const laid = autoLayout(
      visible,
      doc.edges.filter((e) =>
        visible.some((s) => s.id === e.from) && visible.some((s) => s.id === e.to)
      )
    )
    const byId = new Map(laid.map((s) => [s.id, s]))
    const next = doc.screens.map((s) => byId.get(s.id) ?? s)

    // The two visible screens are laid out from the origin…
    expect(next.find((s) => s.key === "a")!.x).toBe(0)
    expect(next.find((s) => s.key === "b")!.x).toBeGreaterThan(0)
    // …and the hidden one keeps whatever it had.
    expect(next.find((s) => s.id === hidden.id)!.x).toBe(5000)
  })
})
