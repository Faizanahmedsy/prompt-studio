import { describe, expect, it } from "vitest"

import { stackWarnings } from "@/features/stack/data/stack-catalogue"
import { stackSchema } from "@/types/project"

const service = (patch: Record<string, string>) =>
  stackWarnings(
    stackSchema.parse({
      framework: "fastapi",
      language: "python",
      styling: "",
      state: "none-state-server",
      forms: "",
      http: "none-http-server",
      icons: "",
      tables: "",
      charts: "",
      database: "postgres",
      orm: "sqlalchemy",
      apiStyle: "rest-openapi",
      apiAuth: "jwt-refresh",
      testing: "pytest",
      tooling: "ruff-mypy",
      packageManager: "uv",
      ...patch,
    })
  ).join(" | ")

describe("a service stack that cannot exist", () => {
  it("is quiet when the combination is a real one", () => {
    expect(service({})).toBe("")
    expect(
      service({
        framework: "nestjs",
        language: "ts-strict",
        orm: "prisma",
        testing: "jest-supertest",
        tooling: "biome",
        packageManager: "pnpm",
      })
    ).toBe("")
  })

  it("catches a Python ORM under a TypeScript framework", () => {
    // Reached by changing the framework and leaving everything else, which is
    // exactly what a person does in a dropdown.
    expect(service({ framework: "nestjs", language: "ts-strict" })).toContain(
      "cannot be used from"
    )
  })

  it("catches a TypeScript ORM under a Python framework", () => {
    expect(service({ orm: "prisma" })).toContain("cannot be used from")
  })

  it("says Django brings its own ORM", () => {
    expect(service({ framework: "django-drf", orm: "sqlalchemy" })).toContain(
      "built on the Django ORM"
    )
  })

  it("catches a tRPC contract on a Python service", () => {
    expect(service({ apiStyle: "trpc" })).toContain("a Python service cannot expose one")
  })

  it("catches a SQL mapper pointed at MongoDB", () => {
    expect(service({ database: "mongodb" })).toContain("talks to a SQL database")
  })

  it("does not fire any of this on a web stack", () => {
    expect(stackWarnings(stackSchema.parse({}))).toEqual([])
  })
})
