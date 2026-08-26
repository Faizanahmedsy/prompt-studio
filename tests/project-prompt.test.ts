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
