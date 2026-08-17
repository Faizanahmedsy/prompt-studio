import { describe, expect, it } from "vitest"

import { analyseGraph, autoLayout } from "@/features/builder/utils/graph"
import { parseFlow } from "@/features/flow-lang/parser"
import { starterDoc } from "@/features/library/data/starters"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { diffLines, diffStats } from "@/features/prompt/engine/diff"
import { projectDocSchema } from "@/types/project"

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
