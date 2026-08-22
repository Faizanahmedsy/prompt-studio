import { describe, expect, it } from "vitest"

import { starterDoc } from "@/features/library/data/starters"
import { decodeShare, encodeShare } from "@/lib/share-codec"
import { projectFileSchema, projectSchema, SCHEMA_VERSION } from "@/types/project"

const file = () => ({
  kind: "prompt-studio/project" as const,
  schemaVersion: SCHEMA_VERSION,
  project: projectSchema.parse({
    ...starterDoc("admin-crud")!,
    id: "prj_test",
    createdAt: 0,
    updatedAt: 0,
    versions: [],
  }),
})

describe("persisted state from an older build", () => {
  /**
   * The crash this guards against: a project saved before `theme.designLanguage`
   * existed reached the UI without it and took the render down. Anything coming
   * out of storage goes through the schema, which fills defaults for fields
   * added since it was written.
   */
  const legacyProject = {
    id: "prj_legacy",
    name: "Legacy project",
    target: "claude-code",
    creativity: 5,
    screens: [
      {
        id: "s1",
        key: "login",
        title: "Sign In",
        template: "auth",
        layout: "auth-split",
        note: "",
        x: 0,
        y: 0,
      },
    ],
    edges: [],
    sections: [],
    // no designLanguage — the field did not exist yet
    theme: {
      primaryColor: "#4f46e5",
      secondaryColor: "#0ea5e9",
      borderRadius: "medium",
      buttonStyle: "filled",
      density: "comfortable",
    },
    requirements: "",
    snippetIds: [],
    createdAt: 1,
    updatedAt: 1,
    schemaVersion: 1,
    versions: [],
  }

  it("fills fields added after the project was saved", () => {
    const parsed = projectSchema.safeParse(legacyProject)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.theme.designLanguage).toBe("modern-soft")
    expect(parsed.data.stack.framework).toBe("next-16")
    expect(parsed.data.structure.preset).toBe("feature-based")
    expect(parsed.data.conventions.ids).toEqual([])
  })

  it("still rejects something that is not a project at all", () => {
    expect(projectSchema.safeParse({ id: "x" }).success).toBe(false)
  })
})

describe("share codec", () => {
  it("round-trips a project through gzip + base64url", async () => {
    const payload = file()
    const token = await encodeShare(payload)
    expect(token.startsWith("v1.") || token.startsWith("p1.")).toBe(true)
    expect(token).not.toMatch(/[+/=]/)
    await expect(decodeShare(token)).resolves.toEqual(payload)
  })

  it("compresses rather than inflates the payload", async () => {
    const payload = file()
    const token = await encodeShare(payload)
    expect(token.length).toBeLessThan(JSON.stringify(payload).length)
  })

  it("rejects a token it did not produce", async () => {
    await expect(decodeShare("not-a-token")).rejects.toThrow()
  })

  it("validates the decoded payload through the file schema", async () => {
    const token = await encodeShare(file())
    const decoded = await decodeShare(token)
    expect(() => projectFileSchema.parse(decoded)).not.toThrow()
  })

  it("refuses arbitrary JSON smuggled into a link", async () => {
    const token = await encodeShare({ kind: "evil", project: { hacked: true } })
    const decoded = await decodeShare(token)
    expect(() => projectFileSchema.parse(decoded)).toThrow()
  })
})
