import { describe, expect, it } from "vitest"

import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { starterDoc } from "@/features/library/data/starters"
import type { ProjectDoc } from "@/types/project"

const threeBuilds = (): ProjectDoc => {
  const base = starterDoc("saas-dashboard")!
  return {
    ...base,
    builds: { web: true, mobile: true, backend: true },
    surfaces: {
      ...base.surfaces,
      backend: {
        ...base.surfaces.backend,
        stack: {
          ...base.surfaces.backend.stack,
          framework: "nestjs",
          database: "mysql",
          orm: "prisma",
          apiStyle: "trpc",
          apiAuth: "session-cookie",
        },
      },
    },
  }
}

describe("a project that ships more than one build", () => {
  it("says which builds it ships, and reads them back", () => {
    const source = serializeFlow(threeBuilds())
    expect(source).toContain("builds web, mobile, backend")
    expect(parseFlow(source).doc.builds).toEqual({ web: true, mobile: true, backend: true })
  })

  it("carries the service's own technology through a round trip", () => {
    // Before this, Flow could not express a service's stack at all — the
    // worked example told the reader to set it in the app after importing,
    // which is an admission that the round trip lost it.
    const source = serializeFlow(threeBuilds())
    expect(source).toContain("stack backend {")
    const back = parseFlow(source).doc.surfaces.backend.stack
    expect(back.framework).toBe("nestjs")
    expect(back.database).toBe("mysql")
    expect(back.orm).toBe("prisma")
    expect(back.apiStyle).toBe("trpc")
    expect(back.apiAuth).toBe("session-cookie")
  })

  it("carries the phone app's stack too, and keeps it apart from the web one", () => {
    const doc = threeBuilds()
    const parsed = parseFlow(serializeFlow(doc)).doc
    expect(parsed.surfaces.mobile.stack.framework).toBe("expo-router")
    expect(parsed.stack.framework).toBe(doc.stack.framework)
    expect(parsed.stack.framework).not.toBe(parsed.surfaces.backend.stack.framework)
  })

  it("gives each build its own folder structure", () => {
    const source = serializeFlow(threeBuilds())
    expect(source).toContain("structure backend src-layered")
    expect(source).toContain("structure mobile expo-feature-based")
    const parsed = parseFlow(source).doc
    expect(parsed.surfaces.backend.structure.preset).toBe("src-layered")
    expect(parsed.structure.preset).toBe("feature-based")
  })

  it("says nothing about builds the project does not ship", () => {
    const source = serializeFlow(starterDoc("saas-dashboard")!)
    expect(source).toContain("builds web")
    expect(source).not.toContain("stack backend {")
    expect(source).not.toContain("stack mobile {")
  })

  it("reads a file written before builds existed as a web project", () => {
    const parsed = parseFlow('app "Old" {\n  target claude-code\n}\n\nscreen home "Home" {}\n')
    expect(parsed.doc.builds).toEqual({ web: true, mobile: false, backend: false })
  })

  it("accepts the words people actually write for a service", () => {
    for (const word of ["backend", "api", "server", "service"]) {
      const parsed = parseFlow(`app "X" {\n  builds web, ${word}\n}\n`)
      expect(parsed.doc.builds.backend).toBe(true)
    }
  })

  it("keeps the current build list and warns when a word is not a build", () => {
    const parsed = parseFlow('app "X" {\n  builds web, hologram\n}\n')
    expect(parsed.doc.builds.web).toBe(true)
    expect(parsed.warnings.map((issue) => issue.message).join(" ")).toContain("hologram")
  })

  it("does not write a stack line for a field the build has no use for", () => {
    // A service has no icon set. An empty `icons` line is something the parser
    // then has to decide what to do with.
    const source = serializeFlow(threeBuilds())
    const backendBlock = source.slice(source.indexOf("stack backend {"))
    expect(backendBlock.slice(0, backendBlock.indexOf("}"))).not.toContain("icons")
  })
})
