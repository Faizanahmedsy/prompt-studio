import { describe, expect, it } from "vitest"

import { starterDoc } from "@/features/library/data/starters"
import { buildProjectPrompt } from "@/features/prompt/engine/build-project-prompt"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import {
  nextVersionFloors,
  securityConstraint,
  VERIFICATION_NOTICE_BODY,
  verificationNotice,
} from "@/features/prompt/engine/security"
import { promptTargets } from "@/features/prompt/engine/targets"
import type { ProjectDoc } from "@/types/project"

const doc = () => starterDoc("saas-dashboard")!

const withFramework = (framework: string): ProjectDoc => {
  const base = doc()
  return { ...base, stack: { ...base.stack, framework } }
}

describe("vulnerable framework versions", () => {
  it("pins Next 16 above the CVE-2025-66478 patch", () => {
    const text = buildPrompt(withFramework("next-16")).text
    expect(text).toContain("next@^16.0.7")
    expect(text).toContain("CVE-2025-66478")
  })

  it("pins Next 15 above its own patch, and names the earlier patched minors", () => {
    const text = buildPrompt(withFramework("next-15")).text
    expect(text).toContain("next@^15.5.7")
    // A team stuck on 15.2 needs the floor for their line, not just the newest.
    expect(text).toContain("15.2.6")
  })

  it("never emits a floor below a published patched release", () => {
    // Guards against a well-meaning edit lowering a pin.
    const patched: Record<string, string> = {
      "next-16": "16.0.7",
      "next-15": "15.5.7",
      "next-pages": "15.5.7",
    }
    for (const [id, min] of Object.entries(patched)) {
      expect(nextVersionFloors[id].min).toBe(min)
    }
  })

  it("says nothing about Next for a stack that has no Next in it", () => {
    expect(securityConstraint("fastapi")).toBe("")
    expect(securityConstraint("vite-react")).toBe("")
    expect(securityConstraint("")).toBe("")
  })

  it("still pins the version when the build starts from the boilerplate", () => {
    // The boilerplate branch of the stack block returns early; a cloned repo
    // can be pinned to a vulnerable release just as easily as a fresh scaffold.
    const base = withFramework("next-16")
    const text = buildPrompt({ ...base, startFrom: "boilerplate" }).text
    expect(text).toContain("16.0.7")
  })

  it("tells the agent to verify the installed version, not just request it", () => {
    expect(buildPrompt(withFramework("next-16")).text).toContain("npm ls next")
  })
})

describe("the honesty clause", () => {
  it("ends every target's single-build prompt", () => {
    for (const target of promptTargets) {
      const text = buildPrompt({ ...doc(), target: target.id }).text
      expect(text).toContain("END TO END INTEGRATION TESTING")
      expect(text).toContain("PLEASE BE HONEST")
      expect(text.trimEnd().endsWith(verificationNotice(target.format).trimEnd())).toBe(
        true
      )
    }
  })

  it("ends the multi-build project prompt too", () => {
    const text = buildProjectPrompt(doc()).text
    expect(text).toContain("END TO END INTEGRATION TESTING")
    expect(text).toContain("Suspicions")
  })

  it("asks for the four-part report, not just a vague caveat", () => {
    for (const heading of ["Verified", "Not verified", "Suspicions", "Assumptions"]) {
      expect(VERIFICATION_NOTICE_BODY).toContain(heading)
    }
  })

  it("matches the surrounding block format", () => {
    expect(verificationNotice("xml")).toContain("<verification>")
    expect(verificationNotice("xml")).not.toContain("## Before")
    expect(verificationNotice("markdown")).toContain("## Before You Report Back")
    expect(verificationNotice("markdown")).not.toContain("<verification>")
  })

  it("appears exactly once, so it cannot be skimmed past as boilerplate", () => {
    const text = buildProjectPrompt(doc()).text
    const hits = text.split("END TO END INTEGRATION TESTING").length - 1
    expect(hits).toBe(1)
  })
})

describe("the floor cannot be lost by a target's layout", () => {
  // The v0 target has no "stack" section in its order. While the version floor
  // was a paragraph inside the stack block, every v0 prompt was generated with
  // no floor at all — and v0 is the builder that scaffolds Next.js itself.
  it("reaches every target, including ones with no stack section", () => {
    for (const target of promptTargets) {
      const text = buildPrompt({ ...withFramework("next-16"), target: target.id }).text
      expect(text, `${target.id} lost the floor`).toContain("16.0.7")
      expect(text, `${target.id} lost the CVE reference`).toContain("CVE-2025-66478")
    }
  })

  it("reaches every target when the project starts from scratch too", () => {
    for (const target of promptTargets) {
      const doc = { ...withFramework("next-16"), target: target.id, startFrom: "scratch" as const }
      expect(buildPrompt(doc).text, `${target.id}`).toContain("16.0.7")
    }
  })

  it("states the floor paragraph exactly once", () => {
    // The boilerplate block also names the CVE — to say its pinned commit is
    // above the floor — so count the floor instruction itself, not the id.
    const text = buildPrompt(withFramework("next-16")).text
    expect(text.split("Version floor — do not ignore").length - 1).toBe(1)
  })

  it("says nothing on a build whose stack has no Next in it", () => {
    const text = buildPrompt({ ...withFramework("vite-react"), target: "generic" }).text
    expect(text).not.toContain("CVE-2025-66478")
  })
})
