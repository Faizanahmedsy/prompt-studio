import { describe, expect, it } from "vitest"

import { starterDoc } from "@/features/library/data/starters"
import { decodeShare, encodeShare } from "@/lib/share-codec"
import { SCHEMA_VERSION, projectFileSchema, projectSchema } from "@/types/project"

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
