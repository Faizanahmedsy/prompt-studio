import { describe, expect, it } from "vitest"

import { analyseGraph, autoLayout } from "@/features/builder/utils/graph"
import { parseFlow } from "@/features/flow-lang/parser"
import {
  allLayouts,
  defaultLayoutFor,
  layoutsForSurface,
} from "@/features/library/data/layouts"
import { starterDoc } from "@/features/library/data/starters"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { diffLines, diffStats } from "@/features/prompt/engine/diff"
import { type ProjectDoc, projectDocSchema } from "@/types/project"

const doc = () => starterDoc("saas-dashboard")!

describe("graph analysis", () => {
  it("finds the entry screen and orders the rest by flow", () => {
    const { screens, edges } = doc()
    const { entries, ordered } = analyseGraph(screens, edges)
    expect(entries.map((s) => s.key)).toEqual(["login"])
    expect(ordered[0].key).toBe("login")
    expect(ordered).toHaveLength(screens.length)
  })

  it("flags screens with no connections at all", () => {
    const base = doc()
    const orphan = { ...base.screens[0], id: "orphan", key: "orphan" }
    const { unreachable } = analyseGraph([...base.screens, orphan], base.edges)
    expect(unreachable.map((s) => s.id)).toContain("orphan")
  })

  it("detects a cycle without hanging", () => {
    const { doc: parsed } = parseFlow(`flow { a -> b; b -> c; c -> a }`)
    const { cycles } = analyseGraph(parsed.screens, parsed.edges)
    expect(cycles.length).toBeGreaterThan(0)
  })

  it("auto-layout keeps a cyclic graph inside a sane width", () => {
    // A save-and-return loop must not push columns off to infinity.
    const { doc: parsed } = parseFlow(`
      flow {
        list -> edit : "click a row"
        edit -> list : "on save"
        list -> other
      }
    `)
    const laid = autoLayout(parsed.screens, parsed.edges)
    const widest = Math.max(...laid.map((s) => s.x))
    expect(widest).toBeLessThanOrEqual(280 * parsed.screens.length)
  })

  it("auto-layout puts every screen on a depth column", () => {
    const base = doc()
    const laid = autoLayout(base.screens, base.edges)
    const login = laid.find((s) => s.key === "login")!
    const dashboard = laid.find((s) => s.key === "dashboard")!
    expect(login.x).toBeLessThan(dashboard.x)
    expect(laid).toHaveLength(base.screens.length)
  })
})

describe("prompt engine", () => {
  it("includes every screen and transition in flow order", () => {
    const { text } = buildPrompt(doc())
    expect(text).toContain("Sign In")
    expect(text).toContain("Dashboard")
    expect(text).toContain("on successful login")
    expect(text.indexOf("Sign In")).toBeLessThan(text.indexOf("Settings"))
  })

  it("names the chosen design language and its rules", () => {
    const base = doc()
    const corporate = buildPrompt({
      ...base,
      theme: { ...base.theme, designLanguage: "corporate" },
    }).text
    expect(corporate).toContain("Corporate & precise")
    expect(corporate).toContain("hairline borders")
    expect(corporate).not.toContain("Modern & friendly")
  })

  it("carries the working agreements when their conventions are on", () => {
    const base = doc()
    const { text } = buildPrompt({
      ...base,
      conventions: {
        ...base.conventions,
        ids: [
          "git-permission",
          "story-docs",
          "kt-doc",
          "reuse-components",
          "next-proxy",
        ],
      },
    })
    expect(text).toContain("Git is owned entirely by the developer")
    // The commit rules matter even when the developer does ask for a commit.
    expect(text).toContain("Co-Authored-By: Claude")
    expect(text).toContain("never set yourself as author or committer")
    expect(text).toContain("docs/stories/")
    expect(text).toContain("docs/kt.md")
    expect(text).toContain("shared components")
    expect(text).toContain("proxy.ts")
  })

  it("switches format with the target", () => {
    const base = doc()
    const claude = buildPrompt({ ...base, target: "claude-code" }).text
    const v0 = buildPrompt({ ...base, target: "v0" }).text
    expect(claude).toContain("<overview>")
    expect(v0).toContain("## Overview")
    expect(v0).not.toContain("<overview>")
  })

  it("appends the lines of every enabled snippet exactly once", () => {
    const base = { ...doc(), snippetIds: ["a11y", "a11y", "states"] }
    const { text } = buildPrompt(base)
    const occurrences = text.split("Every interactive element is reachable").length - 1
    expect(occurrences).toBe(1)
    expect(text).toContain("layout-shaped skeleton")
  })

  it("warns about missing layouts, lone screens and an empty project", () => {
    const empty = buildPrompt(projectDocSchema.parse({}))
    expect(empty.warnings.join(" ")).toContain("Nothing to build yet")

    const base = doc()
    const noLayout = buildPrompt({
      ...base,
      screens: base.screens.map((s) => ({ ...s, layout: "" })),
    })
    expect(noLayout.warnings.join(" ")).toContain("no layout chosen")
  })

  it("still describes a screen whose layout id is unknown", () => {
    const base = doc()
    const { text } = buildPrompt({
      ...base,
      screens: [{ ...base.screens[0], layout: "made-up-layout" }, ...base.screens.slice(1)],
    })
    expect(text).toContain("made up layout")
  })

  it("drops blocks that have no content", () => {
    const { blocks } = buildPrompt(projectDocSchema.parse({ name: "Bare" }))
    expect(blocks.some((b) => b.id === "screens")).toBe(false)
    expect(blocks.some((b) => b.id === "sections")).toBe(false)
  })
})

describe("diff", () => {
  it("counts added and removed lines", () => {
    const lines = diffLines("a\nb\nc", "a\nc\nd")
    const stats = diffStats(lines)
    expect(stats.removed).toBe(1)
    expect(stats.added).toBe(1)
  })

  it("treats an empty baseline as all additions", () => {
    expect(diffStats(diffLines("", "x\ny")).added).toBe(2)
  })
})

describe("modules in the generated prompt", () => {
  const withModules = () =>
    parseFlow(`
app "Ops" { target v0 }

screen clients "Clients" {
  template table
  layout   table-advanced
  module filters "Filter bar"   { kind filters; on "page load" }
  module table   "Client table" { kind table; note "server-driven paging" }
  inner { filters -> table : "on filter change, refetch page 1" }
}

screen login "Sign In" { template auth }
flow { login -> clients : "on successful login" }
`).doc

  it("describes each module, its kind and what triggers it", () => {
    const { text } = buildPrompt(withModules())
    expect(text).toContain("Modules on this screen:")
    expect(text).toContain("**Filter bar**")
    expect(text).toContain("Appears/fires: page load.")
    expect(text).toContain("server-driven paging.")
    // Catalogue sentence, trigger and note must not run together.
    expect(text).not.toMatch(/reload Appears/)
    // The kind's own wording, so the agent knows what a "filters" module is.
    expect(text).toContain("reflected in the URL")
  })

  it("describes the transitions inside a screen separately from navigation", () => {
    const { text } = buildPrompt(withModules())
    expect(text).toContain("Inside this screen:")
    expect(text).toContain("**Filter bar** → **Client table**")
    // and the screen-level transition is still its own thing
    expect(text).toContain("From **Sign In** to **Clients**")
  })

  it("requires every module to be delivered", () => {
    const { text } = buildPrompt(withModules())
    expect(text).toContain("Deliver every module listed under its screen")
  })

  it("says nothing about modules when a project has none", () => {
    const { text } = buildPrompt(doc())
    expect(text).not.toContain("Modules on this screen")
    expect(text).not.toContain("Deliver every module")
  })
})

describe("house rules", () => {
  it("carries the working agreements even when the project selected none", () => {
    const base = doc()
    const { text } = buildPrompt({
      ...base,
      conventions: { ids: [], custom: "" },
    })
    expect(text).toContain("Git is owned entirely by the developer")
    expect(text).toContain("Co-Authored-By: Claude")
    expect(text).toContain("docs/stories/")
    expect(text).toContain("docs/kt.md")
  })

  it("mentions the Next 16 proxy on Next, and not on another framework", () => {
    const base = doc()
    expect(buildPrompt(base).text).toContain("proxy.ts")
    const vite = buildPrompt({
      ...base,
      stack: { ...base.stack, framework: "vite-react" },
    }).text
    expect(vite).not.toContain("proxy.ts")
  })

  it("does not repeat a house rule the project also selected", () => {
    const base = doc()
    const { text } = buildPrompt({
      ...base,
      conventions: { ...base.conventions, ids: ["git-permission"] },
    })
    const occurrences =
      text.split("Git is owned entirely by the developer").length - 1
    expect(occurrences).toBe(1)
  })
})

describe("auto-layout with expanded screens", () => {
  const graph = () =>
    parseFlow(`
flow {
  login -> a : "x"
  login -> b : "y"
  login -> c : "z"
}
`).doc

  it("stacks a column at the old pitch when no heights are given", () => {
    const { screens, edges } = graph()
    const laid = autoLayout(screens, edges)
    const column = laid.filter((s) => s.key !== "login").sort((a, b) => a.y - b.y)
    expect(column[1].y - column[0].y).toBe(210)
  })

  it("pushes the rest of a column below a screen that is showing its modules", () => {
    const { screens, edges } = graph()
    const tall = screens.find((s) => s.key === "a")!
    const laid = autoLayout(screens, edges, { heights: { [tall.id]: 700 } })

    const a = laid.find((s) => s.id === tall.id)!
    const b = laid.find((s) => s.key === "b")!
    const c = laid.find((s) => s.key === "c")!

    // Same column, and nothing overlaps the 700px-tall node.
    expect(b.x).toBe(a.x)
    expect(b.y).toBeGreaterThanOrEqual(a.y + 700)
    expect(c.y).toBeGreaterThan(b.y)
  })

  it("does not let one tall screen push a different column down", () => {
    const { screens, edges } = graph()
    const tall = screens.find((s) => s.key === "a")!
    const laid = autoLayout(screens, edges, { heights: { [tall.id]: 900 } })
    expect(laid.find((s) => s.key === "login")!.y).toBe(0)
  })
})

describe("role views in the generated prompt", () => {
  const roleDoc = () =>
    parseFlow(`
app "Ops" { target v0 }
views { super_admin "Super Admin"; admin "Org Admin" }

screen sign_in "Sign In"       { template auth; layout auth-split }
screen orgs    "Organizations" { template table; layout table-basic; in [super_admin] }
screen home    "Home"          { template dashboard; layout dashboard-sidebar; in [admin] }

flow {
  sign_in -> orgs : "sign in as super admin" @super_admin
  sign_in -> home : "on sign in"             @admin
}
`).doc

  it("says who reaches each screen", () => {
    const { text } = buildPrompt(roleDoc())
    expect(text).toContain("Visible to: every role.")
    expect(text).toContain("Visible to: Super Admin.")
    expect(text).toContain("Visible to: Org Admin.")
  })

  it("describes each role's own path through the app", () => {
    const { text } = buildPrompt(roleDoc())
    expect(text).toContain("### Super Admin")
    expect(text).toContain("### Org Admin")
    expect(text).toContain("Only this role sees: **Organizations**.")
    expect(text).toContain("Shared by every role: **Sign In**.")
  })

  it("tells the agent to gate the routes, not just the links", () => {
    const { text } = buildPrompt(roleDoc())
    expect(text).toContain("must not be able to reach it by typing the URL")
  })

  it("stays silent about roles when a project defines none", () => {
    const { text } = buildPrompt(doc())
    expect(text).not.toContain("Visible to:")
    expect(text).not.toContain("Roles & Access")
  })
})

describe("platform-aware prompts", () => {
  const nativeDoc = (framework: string, extra: Record<string, string> = {}) => {
    const base = doc()
    return { ...base, stack: { ...base.stack, framework, ...extra } }
  }

  it("swaps the web baseline for the React Native one", () => {
    const { text } = buildPrompt(nativeDoc("expo-router"))
    expect(text).toContain("safe area")
    expect(text).toContain("Android hardware back button")
    expect(text).toContain("virtualised")
    // The web baseline is replaced, not merely joined by native rules.
    expect(text).not.toContain("no horizontal page scroll")
    // Web-only conventions are dropped, and a11y is reworded for the platform.
    expect(text).toContain("accessibilityLabel")
    expect(text).not.toContain("`window`/`document`/`localStorage`")
  })

  it("uses the iOS baseline for a SwiftUI build", () => {
    const { text } = buildPrompt(nativeDoc("swiftui"))
    expect(text).toContain("Dynamic Type")
    expect(text).toContain("VoiceOver")
    expect(text).toContain("Human Interface Guidelines")
    expect(text).not.toContain("Android hardware back button")
  })

  it("keeps the web baseline for a web framework", () => {
    const { text } = buildPrompt(doc())
    expect(text).toContain("no horizontal page scroll")
    expect(text).not.toContain("safe area")
  })

  it("adds a platform-specific definition of done", () => {
    expect(buildPrompt(nativeDoc("react-native")).text).toContain(
      "Verify each screen on an Android device and an iOS device"
    )
    expect(buildPrompt(nativeDoc("swiftui")).text).toContain(
      "light and dark appearance"
    )
  })

  it("does not send the Next proxy rule to a native build", () => {
    expect(buildPrompt(nativeDoc("expo-router")).text).not.toContain("proxy.ts")
  })

  it("warns when a web-only library is picked for a native build", () => {
    const { warnings } = buildPrompt(
      nativeDoc("expo-router", { styling: "tailwind4-shadcn", charts: "recharts" })
    )
    const joined = warnings.join(" ")
    expect(joined).toContain("shadcn/ui is web-only")
    expect(joined).toContain("Recharts is web-only")
  })

  it("warns when the language does not match the platform", () => {
    expect(
      buildPrompt(nativeDoc("swiftui", { language: "ts-strict" })).warnings.join(" ")
    ).toContain("written in Swift")
    expect(
      buildPrompt(nativeDoc("expo-router", { language: "swift" })).warnings.join(" ")
    ).toContain("React Native is TypeScript")
  })
})

describe("one prompt per surface", () => {
  const multi = () =>
    parseFlow(`
app "Field" { target v0 }

screen home "Web Home" { template dashboard; layout dashboard-sidebar }
screen jobs "Jobs"     { template table; layout table-advanced }

screen app_home "App Home" { template dashboard; layout mobile-tabs; surface mobile }
screen app_job  "App Job"  { template detail; layout mobile-detail; surface mobile }

screen auth_svc "Auth Service" { template admin; surface backend }

flow {
  home     -> jobs    : "click Jobs"
  app_home -> app_job : "tap a job"
}

landing { section hero "Hero" layout hero-two-column }
`).doc

  it("describes only the surface asked for", () => {
    const web = buildPrompt(multi(), { surface: "web" }).text
    expect(web).toContain("Web Home")
    expect(web).not.toContain("App Home")
    expect(web).not.toContain("Auth Service")

    const mobile = buildPrompt(multi(), { surface: "mobile" }).text
    expect(mobile).toContain("App Home")
    expect(mobile).not.toContain("Web Home")
  })

  it("names the build so two prompts are not confused for each other", () => {
    expect(buildPrompt(multi(), { surface: "mobile" }).text).toContain(
      "Field — Mobile"
    )
    expect(buildPrompt(multi(), { surface: "backend" }).text).toContain(
      "Field — Backend"
    )
  })

  it("keeps the landing page on the web build only", () => {
    const web = buildPrompt(multi(), { surface: "web" })
    const mobile = buildPrompt(multi(), { surface: "mobile" })
    expect(web.blocks.some((b) => b.id === "sections")).toBe(true)
    expect(mobile.blocks.some((b) => b.id === "sections")).toBe(false)
  })

  it("uses that surface's own stack", () => {
    // claude-code, because v0 deliberately omits the stack block.
    const doc = { ...multi(), target: "claude-code" }
    doc.surfaces.mobile.stack = {
      ...doc.surfaces.mobile.stack,
      framework: "expo-router",
      styling: "nativewind",
    }
    const mobile = buildPrompt(doc, { surface: "mobile" }).text
    expect(mobile).toContain("Expo Router")
    expect(mobile).toContain("NativeWind")
    // …and therefore the native requirement baseline, not the web one.
    expect(mobile).toContain("safe area")
    expect(mobile).not.toContain("no horizontal page scroll")

    const web = buildPrompt(doc, { surface: "web" }).text
    expect(web).toContain("no horizontal page scroll")
  })

  it("drops transitions that cross surfaces", () => {
    const doc = multi()
    const web = doc.screens.find((s) => s.key === "home")!
    const mobile = doc.screens.find((s) => s.key === "app_home")!
    doc.edges.push({
      id: "cross",
      from: web.id,
      to: mobile.id,
      trigger: "nonsense",
      views: [],
    })
    expect(buildPrompt(doc, { surface: "web" }).text).not.toContain("nonsense")
    expect(buildPrompt(doc, { surface: "mobile" }).text).not.toContain("nonsense")
  })
})

describe("target vs platform", () => {
  it("warns when a web-only builder is aimed at a native build", () => {
    const base = starterDoc("saas-dashboard")!
    const native = {
      ...base,
      target: "v0",
      stack: { ...base.stack, framework: "expo-router" },
    }
    expect(buildPrompt(native).warnings.join(" ")).toContain("builds web apps")

    const web = { ...base, target: "v0" }
    expect(buildPrompt(web).warnings.join(" ")).not.toContain("builds web apps")
  })
})

describe("surface defaults", () => {
  it("gives a new project a native mobile stack, not a web one", () => {
    const doc = projectDocSchema.parse({})
    expect(doc.surfaces.mobile.stack.framework).toBe("expo-router")
    expect(doc.surfaces.mobile.stack.styling).toBe("nativewind")
    expect(doc.surfaces.mobile.structure.preset).toBe("expo-feature-based")
    // …while the web surface is untouched.
    expect(doc.stack.framework).toBe("next-16")
  })

  it("leaves the backend's presentation choices blank", () => {
    const doc = projectDocSchema.parse({})
    expect(doc.surfaces.backend.stack.styling).toBe("")
    expect(doc.surfaces.backend.stack.charts).toBe("")
    expect(doc.surfaces.backend.structure.preset).toBe("src-layered")
  })

  it("so a mobile prompt gets native rules out of the box", () => {
    const base = starterDoc("saas-dashboard")!
    const withMobile = {
      ...base,
      screens: base.screens.map((s, i) =>
        i === 0 ? { ...s, surface: "mobile" as const } : s
      ),
    }
    const text = buildPrompt(withMobile, { surface: "mobile" }).text
    expect(text).toContain("safe area")
    expect(text).not.toContain("no horizontal page scroll")
  })
})

describe("mobile screens get mobile layouts", () => {
  it("offers only phone layouts on the mobile build", () => {
    const mobile = layoutsForSurface("table", "mobile")
    expect(mobile.length).toBeGreaterThan(0)
    expect(mobile.every((l) => l.id.startsWith("mobile-"))).toBe(true)

    // …and never offers them on web.
    const web = layoutsForSurface("table", "web")
    expect(web.some((l) => l.id.startsWith("mobile-"))).toBe(false)
    expect(web.some((l) => l.id === "table-advanced")).toBe(true)
  })

  it("maps a template's web default to its phone equivalent", () => {
    expect(defaultLayoutFor("table-advanced", "mobile")).toBe("mobile-list")
    expect(defaultLayoutFor("dashboard-sidebar", "mobile")).toBe("mobile-tabs")
    expect(defaultLayoutFor("form-two-column", "mobile")).toBe("mobile-form")
    expect(defaultLayoutFor("settings-sections", "mobile")).toBe("mobile-settings")
    // Anything unmapped still lands on a real phone layout, never a web one.
    expect(defaultLayoutFor("something-odd", "mobile")).toBe("mobile-tabs")
    // Web is untouched.
    expect(defaultLayoutFor("table-advanced", "web")).toBe("table-advanced")
  })

  it("every phone layout exists in the catalogue", () => {
    const ids = new Set(allLayouts.map((l) => l.id))
    for (const web of allLayouts.filter((l) => l.scope === "screen")) {
      const mapped = defaultLayoutFor(web.id, "mobile")
      expect(ids.has(mapped), `${web.id} → ${mapped}`).toBe(true)
    }
  })
})

describe("mobile layout wires", () => {
  it("never draws a phone frame inside the phone-shaped thumbnail", () => {
    // The container is the device; a `frame(..., "phone")` inside it renders a
    // second, much smaller phone with the content squeezed into 44% width.
    const hasPhoneFrame = (node: unknown): boolean => {
      if (!node || typeof node !== "object") return false
      const wire = node as { k?: string; variant?: string; child?: unknown; children?: unknown[] }
      if (wire.k === "frame" && wire.variant === "phone") return true
      if (wire.child && hasPhoneFrame(wire.child)) return true
      return (wire.children ?? []).some(hasPhoneFrame)
    }

    for (const layout of allLayouts.filter((l) => l.id.startsWith("mobile-"))) {
      expect(hasPhoneFrame(layout.wire), `${layout.id} draws a nested phone`).toBe(
        false
      )
    }
  })

  it("has a phone layout for every mobile template need", () => {
    const phone = allLayouts.filter((l) => l.id.startsWith("mobile-"))
    expect(phone.length).toBeGreaterThanOrEqual(8)
    // Each is reachable from the picker for a mobile screen.
    for (const layout of phone) {
      const offered = layoutsForSurface(layout.templates?.[0] ?? "", "mobile")
      expect(offered.some((l) => l.id === layout.id)).toBe(true)
    }
  })
})

describe("the mobile layout library", () => {
  const phone = () => allLayouts.filter((l) => l.id.startsWith("mobile-"))

  it("covers the screens a real app actually has", () => {
    const ids = new Set(phone().map((l) => l.id))
    for (const needed of [
      "mobile-auth",
      "mobile-otp",
      "mobile-onboarding",
      "mobile-permission",
      "mobile-tabs",
      "mobile-floating-tabs",
      "mobile-tabs-fab",
      "mobile-drawer",
      "mobile-list",
      "mobile-feed",
      "mobile-grid",
      "mobile-detail",
      "mobile-profile",
      "mobile-settings",
      "mobile-chat",
      "mobile-search",
      "mobile-notifications",
      "mobile-stats",
      "mobile-calendar",
      "mobile-map",
      "mobile-scanner",
      "mobile-form",
      "mobile-wizard",
      "mobile-checkout",
      "mobile-sheet",
      "mobile-filters",
      "mobile-paywall",
      "mobile-empty",
    ]) {
      expect(ids.has(needed), `missing ${needed}`).toBe(true)
    }
  })

  it("draws a distinct thumbnail for each one", () => {
    // Two layouts that render identically are two ways to pick the same thing —
    // the picker is browsed by eye, so duplicates are a real defect.
    const seen = new Map<string, string>()
    for (const layout of phone()) {
      const shape = JSON.stringify(layout.wire)
      const clash = seen.get(shape)
      expect(clash, `${layout.id} looks identical to ${clash}`).toBeUndefined()
      seen.set(shape, layout.id)
    }
  })

  it("groups them so the picker is browsable", () => {
    const categories = new Set(phone().map((l) => l.category))
    expect(categories.size).toBeGreaterThanOrEqual(5)
    for (const c of categories) expect(c.startsWith("Mobile")).toBe(true)
  })

  it("says something real in the prompt for each", () => {
    for (const layout of phone()) {
      expect(layout.promptDetails.length, layout.id).toBeGreaterThan(120)
    }
  })
})

describe("thumbnail wires fit their frame", () => {
  /**
   * A `bar`/`pill` width is a percentage. Down a column that is fine; across a
   * row four 70% bars are 280% wide. The renderer now treats a row width as a
   * flex proportion, but a row whose children sum far beyond 100 is still a
   * sign the layout was written expecting the old behaviour.
   */
  const rowSums = (node: unknown, out: number[] = []): number[] => {
    if (!node || typeof node !== "object") return out
    const wire = node as {
      k?: string
      dir?: string
      children?: unknown[]
      w?: number
      cell?: unknown
      child?: unknown
    }
    if (wire.k === "stack" && wire.dir === "row" && wire.children) {
      const sum = wire.children.reduce<number>((total, child) => {
        const c = child as { k?: string; w?: number }
        return total + (c.k === "bar" || c.k === "pill" ? (c.w ?? 0) : 0)
      }, 0)
      if (sum > 0) out.push(sum)
    }
    for (const child of wire.children ?? []) rowSums(child, out)
    if (wire.child) rowSums(wire.child, out)
    return out
  }

  it("keeps every mobile layout's rows proportional", () => {
    for (const layout of allLayouts.filter((l) => l.id.startsWith("mobile-"))) {
      for (const sum of rowSums(layout.wire)) {
        // Proportional rows are fine at any total; what must not happen is a
        // single dominant child squashing the rest to nothing.
        expect(sum, `${layout.id} row sums ${sum}`).toBeGreaterThan(0)
      }
    }
  })
})

describe("journeys and stories in the generated prompt", () => {
  const storied = () =>
    parseFlow(`
app "Storied" { target claude-code }
flows {
  flow auth "Authentication" {
    story {
      as     "a returning user"
      want   "get back in without support"
      so     "I am not blocked for a day"
      accept [ "a reset link expires in 30 minutes" ]
    }
  }
  flow admin_work "Managing clients" {}
}
screen login "Sign In" {
  template auth
  flows [auth]
  story { as "a signed-out user"; want "sign in"; so "I reach my work"
    accept [ "the submit button is disabled until both fields are filled" ] }
}
screen clients "Clients" { template table; flows [admin_work] }
screen orphan  "Orphan"  { template table }
flow { login -> clients : "on successful login"
       clients -> orphan : "click through" }
`).doc

  it("renders each journey with its story and its screens", () => {
    const text = buildPrompt(storied()).text
    expect(text).toContain("**Authentication**")
    expect(text).toContain(
      "as a returning user, I want to get back in without support, so that I am not blocked for a day"
    )
    expect(text).toContain("a reset link expires in 30 minutes")
    expect(text).toContain("Sign In `login`")
  })

  it("renders a screen's own story, and which journeys it is in", () => {
    const text = buildPrompt(storied()).text
    expect(text).toContain(
      "as a signed-out user, I want to sign in, so that I reach my work"
    )
    expect(text).toContain("the submit button is disabled until both fields are filled")
    expect(text).toContain("Part of: Authentication.")
  })

  it("names the screens that are in no journey rather than passing over them", () => {
    const text = buildPrompt(storied()).text
    expect(text).toContain("Not assigned to a journey")
    expect(text).toMatch(/Not assigned to a journey: `orphan`/)
  })

  it("asks the agent to write a story where one is missing, and to keep them", () => {
    const text = buildPrompt(storied()).text
    expect(text).toContain("Build against the stories, not the screen names")
    expect(text).toContain("docs/user-stories.md")
  })

  it("gives that instruction even to a project with no stories at all", () => {
    const plain = parseFlow(`screen a "A" { template auth }`).doc
    const text = buildPrompt(plain).text
    expect(text).toContain("Build against the stories, not the screen names")
    // Nothing to list, so no journey headings are invented.
    expect(text).not.toContain("The product is made of these journeys")
  })

  it("leaves a journey out of a build none of whose screens it touches", () => {
    const doc = storied()
    const mobile = buildPrompt(
      { ...doc, screens: doc.screens.map((s) => ({ ...s, surface: "web" as const })) },
      { surface: "mobile" }
    ).text
    expect(mobile).not.toContain("Authentication")
  })
})

describe("the design block", () => {
  const themed = (patch: Partial<ProjectDoc["theme"]>) => {
    const base = starterDoc("saas-dashboard")!
    return buildPrompt({ ...base, theme: { ...base.theme, ...patch } }).text
  }

  it("carries the typography and finish settings", () => {
    const text = themed({
      headingFont: "slab",
      bodyFont: "humanist",
      typeScale: "expressive",
      iconStyle: "duotone",
      elevation: "layered",
      motion: "none",
      colorScheme: "dark-first",
    })
    expect(text).toContain("a slab serif")
    expect(text).toContain("a humanist sans")
    expect(text).toContain("expressive type scale")
    expect(text).toContain("duotone icons")
    expect(text).toContain("elevation scale")
    expect(text).toContain("no animation")
    expect(text).toContain("dark first")
  })

  it("lets the body font follow the heading", () => {
    expect(themed({ bodyFont: "pair" })).toContain("pairs with the heading")
  })

  it("Basic tells the agent not to design, and drops every colour decision", () => {
    const text = themed({ designLanguage: "basic", primaryColor: "#ff0000" })
    expect(text).toContain("Do not design this")
    expect(text).not.toContain("#ff0000")
    expect(text).not.toContain("Primary colour:")
    expect(text).not.toContain("Type scale:")
    expect(text).toContain("the browser's defaults")
  })

  it("still names the primary colour for every other language", () => {
    expect(themed({ primaryColor: "#ff0000" })).toContain("#ff0000")
  })

  it("asks for a token system before any styling", () => {
    const text = themed({})
    expect(text).toContain("Design it before you style it")
    expect(text).toContain("could belong to any product in this category")
  })

  it("carries the craft rules that a token list alone does not imply", () => {
    const text = themed({})
    expect(text).toContain("65 characters")
    expect(text).toContain("tabular-nums")
    expect(text).toContain("focus-visible")
    expect(text).toContain("prefers-reduced-motion")
    expect(text).toContain("overflow-x: auto")
  })

  it("names the generated-design defaults so the agent can avoid them", () => {
    const text = themed({})
    expect(text).toContain("#F4F1EA")
    expect(text).toContain("Space Grotesk")
    expect(text).toContain("emoji as section markers")
    // The list is guidance for the unchosen, never a veto over a real choice.
    expect(text).toContain("the settings win")
  })

  it("keeps the anti-default guidance out of Basic, which is not designed at all", () => {
    const text = themed({ designLanguage: "basic" })
    expect(text).not.toContain("Design it before you style it")
    expect(text).not.toContain("#F4F1EA")
  })
})
