import { describe, expect, it } from "vitest"
import { starterDoc } from "@/features/library/data/starters"
import { buildProjectPrompt } from "@/features/prompt/engine/build-project-prompt"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { isMultiBuild, selectedSurfaces } from "@/features/prompt/engine/monorepo"
import type { ProjectDoc, Surface } from "@/types/project"

/** A project whose screens are spread across all three builds. */
function system(): ProjectDoc {
  const base = starterDoc("saas-dashboard")!
  return {
    ...base,
    builds: { web: true, mobile: true, backend: true },
    screens: base.screens.map((screen, index) => ({
      ...screen,
      surface: (index % 3 === 0 ? "backend" : index % 3 === 1 ? "mobile" : "web") as Surface,
    })),
  }
}

describe("one prompt for a system of builds", () => {
  it("falls back to the single-build prompt when only one is selected", () => {
    const doc = { ...starterDoc("saas-dashboard")!, builds: { web: true, mobile: false, backend: false } }
    expect(isMultiBuild(doc)).toBe(false)
    expect(buildProjectPrompt(doc).text).toBe(buildPrompt(doc, { surface: "web" }).text)
  })

  it("describes the service before the apps that call it", () => {
    // Order is an instruction. The contract has to exist before a client can be
    // pointed at it, and the prompt is read top to bottom.
    expect(selectedSurfaces(system())).toEqual(["backend", "web", "mobile"])
    const ids = buildProjectPrompt(system()).blocks.map((block) => block.id)
    expect(ids.indexOf("build_backend")).toBeLessThan(ids.indexOf("build_web"))
    expect(ids.indexOf("build_web")).toBeLessThan(ids.indexOf("build_mobile"))
  })

  it("gives every build its own folder and says so", () => {
    const text = buildProjectPrompt(system()).text
    expect(text).toContain("apps/web")
    expect(text).toContain("apps/mobile")
    expect(text).toContain("services/api")
    expect(text).toContain("packages/shared")
  })

  it("draws only the folders for the builds that were chosen", () => {
    const doc = { ...system(), builds: { web: true, mobile: false, backend: true } }
    const text = buildProjectPrompt(doc).text
    expect(text).toContain("services/api")
    expect(text).not.toContain("apps/mobile")
  })

  it("states the design system once rather than once per build", () => {
    const blocks = buildProjectPrompt(system()).blocks.filter((block) => block.id === "design")
    expect(blocks).toHaveLength(1)
  })

  it("tells the agent to build the service first and publish the contract", () => {
    const text = buildProjectPrompt(system()).text
    expect(text).toContain("Build the service first")
    expect(text).toContain("packages/shared")
    expect(text).toContain("Neither client hand-writes a type the service already knows")
  })

  it("adapts the contract instruction to the API style", () => {
    const doc = system()
    const openapi = { ...doc, surfaces: { ...doc.surfaces, backend: { ...doc.surfaces.backend, stack: { ...doc.surfaces.backend.stack, apiStyle: "rest-openapi" } } } }
    const graphql = { ...doc, surfaces: { ...doc.surfaces, backend: { ...doc.surfaces.backend, stack: { ...doc.surfaces.backend.stack, apiStyle: "graphql" } } } }
    expect(buildProjectPrompt(openapi).text).toContain("OpenAPI schema")
    expect(buildProjectPrompt(graphql).text).toContain("GraphQL schema")
  })

  it("asks for tests that cross the boundary, not three green suites", () => {
    const text = buildProjectPrompt(system()).text
    expect(text).toContain("Each build having its own passing tests does not mean the system works")
    expect(text).toContain("against a real database")
    // And names the journeys it wants covered.
    expect(text).toContain(system().flows[0].name)
  })

  it("asks the agent to report what it actually ran", () => {
    expect(buildProjectPrompt(system()).text).toContain("say which tests exist, which passed")
  })

  it("warns when a declared build has no screens to implement", () => {
    const doc = { ...starterDoc("saas-dashboard")!, builds: { web: true, mobile: true, backend: true } }
    const warnings = buildProjectPrompt(doc).warnings.join(" ")
    expect(warnings).toContain("no screen is tagged `surface mobile`")
    expect(warnings).toContain("no screen is tagged `surface backend`")
  })

  it("catches a contract a Python service cannot possibly expose", () => {
    const doc = system()
    const trpc = {
      ...doc,
      surfaces: {
        ...doc.surfaces,
        backend: {
          ...doc.surfaces.backend,
          stack: { ...doc.surfaces.backend.stack, framework: "fastapi", apiStyle: "trpc" },
        },
      },
    }
    expect(buildProjectPrompt(trpc).warnings.join(" ")).toContain(
      "a Python service cannot expose one"
    )
  })

  it("keeps each build's screens under that build's heading", () => {
    const doc = system()
    const built = buildProjectPrompt(doc)
    const web = built.blocks.find((block) => block.id === "build_web")?.body ?? ""
    const webScreens = doc.screens.filter((screen) => screen.surface === "web")
    const backendScreens = doc.screens.filter((screen) => screen.surface === "backend")
    expect(web).toContain(webScreens[0].title)
    // A backend screen must not appear in the web build's section.
    expect(web).not.toContain(backendScreens[0].title)
  })

  it("says the whole thing is one system, not three projects", () => {
    expect(buildProjectPrompt(system()).text).toContain(
      "They are not three projects that happen to share a folder"
    )
  })
})

describe("the boilerplate inside a repository of builds", () => {
  const withRepo = (builds: Partial<ProjectDoc["builds"]>) => {
    const base = system()
    return buildProjectPrompt({
      ...base,
      startFrom: "boilerplate",
      builds: { ...base.builds, ...builds },
    })
  }

  it("does not vanish when the project ships more than one build", () => {
    // It is excluded from the per-build sections, so unless the composer
    // restates it the clone instruction disappears and the web app is
    // scaffolded from scratch without anybody being told.
    expect(withRepo({}).text).toContain("git clone")
  })

  it("clones into the web build's folder, not over the whole repository", () => {
    const text = withRepo({}).text
    expect(text).toContain("apps/web")
    expect(text).toContain("git clone --no-checkout")
    // Cloning as the root would put the web app's files where the service goes.
    expect(text).not.toMatch(/git clone[^\n]*\.git\s*$/m)
  })

  it("says what changes about the boilerplate once it lives in a repository", () => {
    const text = withRepo({}).text
    expect(text).toContain("workspace member")
    expect(text).toContain("generated client from `packages/shared`")
  })

  it("admits there is no boilerplate for the other builds", () => {
    expect(withRepo({}).text).toContain("The other builds have no boilerplate")
  })

  it("says so plainly when the project ships no web build at all", () => {
    const text = withRepo({ web: false }).text
    expect(text).toContain("this project does not ship one")
    expect(text).not.toContain("git clone")
  })

  it("stays silent when the project never asked for it", () => {
    expect(buildProjectPrompt(system()).text).not.toContain("git clone")
  })
})

describe("a service is not a screen", () => {
  it("does not describe a layout for something with no UI", () => {
    const doc = system()
    const built = buildProjectPrompt(doc)
    const backend = built.blocks.find((block) => block.id === "build_backend")?.body ?? ""
    const web = built.blocks.find((block) => block.id === "build_web")?.body ?? ""
    expect(web).toContain("Layout:")
    expect(backend).not.toContain("Layout:")
  })

  it("does not complain that a service has no layout chosen", () => {
    const doc = system()
    const stripped = {
      ...doc,
      screens: doc.screens.map((screen) =>
        screen.surface === "backend" ? { ...screen, layout: "" } : screen
      ),
    }
    const warnings = buildProjectPrompt(stripped).warnings.join(" ")
    expect(warnings).not.toContain("have no layout chosen")
  })
})

describe("what the checks say about a system", () => {
  it("has nothing to complain about when the project is well formed", () => {
    // The starter is the worked example of this whole feature. If it cannot
    // pass its own checks, nothing built from it will either.
    expect(buildProjectPrompt(starterDoc("full-system")!).warnings).toEqual([])
  })

  it("does not report a service area as an unconnected screen", () => {
    // A service is reached by an HTTP call, not by a transition — every
    // three-build project was being told its flow was broken.
    const doc = starterDoc("full-system")!
    expect(doc.screens.some((screen) => screen.surface === "backend")).toBe(true)
    expect(buildProjectPrompt(doc).warnings.join(" ")).not.toContain("not connected")
  })

  it("judges roles and connections against the project, not one build at a time", () => {
    const doc = starterDoc("full-system")!
    const warnings = buildProjectPrompt(doc).warnings.join(" ")
    // Both roles are tagged on web screens and on none of the backend ones.
    expect(warnings).not.toContain("No screen is tagged")
    expect(warnings).not.toContain("No connections yet")
  })

  it("still says so when a build really has nothing in it", () => {
    const doc = starterDoc("full-system")!
    const withoutMobile = {
      ...doc,
      screens: doc.screens.filter((screen) => screen.surface !== "mobile"),
    }
    expect(buildProjectPrompt(withoutMobile).warnings.join(" ")).toContain(
      "no screen is tagged `surface mobile`"
    )
  })
})
