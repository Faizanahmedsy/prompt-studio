import { describe, expect, it } from "vitest"

import { starterDoc } from "@/features/library/data/starters"
import {
  BOILERPLATE,
  cloneLines,
  usesBoilerplate,
} from "@/features/prompt/engine/boilerplate"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { nextVersionFloors } from "@/features/prompt/engine/security"
import { promptTargets } from "@/features/prompt/engine/targets"

const base = () => starterDoc("saas-dashboard")!
const withRepo = () => ({ ...base(), startFrom: "boilerplate" as const })
/** Explicitly opted out — the default is now to clone. */
const fromScratch = () => ({ ...base(), startFrom: "scratch" as const })

describe("starting from the boilerplate", () => {
  it("is what a project gets by default", () => {
    // The starter repo is the intended path: a brief that scaffolds from
    // scratch re-derives a folder tree, a design token set and an http client
    // that already exist and are already known to build.
    const text = buildPrompt(base()).text
    expect(text).toContain(BOILERPLATE.url)
    expect(text).toContain("git clone")
  })

  it("says nothing at all once the project opts out", () => {
    const text = buildPrompt(fromScratch()).text
    expect(text).not.toContain(BOILERPLATE.url)
    expect(text).not.toContain("git clone")
  })

  it("pins a commit rather than a branch", () => {
    const text = buildPrompt(withRepo()).text
    // A branch moves. A brief handed to a developer must build the same thing
    // next month as it does today.
    expect(BOILERPLATE.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(text).toContain(`git checkout ${BOILERPLATE.commit}`)
    expect(text).not.toMatch(/git clone[^\n]*--branch main/)
  })

  it("drops the cloned history so it becomes their project", () => {
    expect(cloneLines("Acme Admin")).toContain("rm -rf .git && git init")
  })

  it("names the folder after the project", () => {
    expect(cloneLines("Acme Admin Panel")).toContain("acme-admin-panel")
    // A name that slugifies to nothing still has to produce a valid command.
    expect(cloneLines("///")).toContain(" app")
  })

  it("stops repeating the folder tree the clone already has", () => {
    const scratch = buildPrompt(fromScratch()).text
    const repo = buildPrompt(withRepo()).text
    expect(scratch).toContain("Use this folder structure")
    expect(repo).not.toContain("Use this folder structure")
  })

  it("points at CLAUDE.md instead of restating the conventions", () => {
    const repo = buildPrompt(withRepo()).text
    expect(repo).toContain("`CLAUDE.md`")
    // One of the convention lines, verbatim, from the scratch prompt.
    expect(buildPrompt(fromScratch()).text).toContain("Files and folders are kebab-case")
    expect(repo).not.toContain("Files and folders are kebab-case")
  })

  it("keeps whatever the project added by hand on top of the repo", () => {
    const doc = { ...withRepo(), conventions: { ids: [], custom: "Never log a customer's address." } }
    const text = buildPrompt(doc).text
    expect(text).toContain("Never log a customer's address.")
  })

  it("lets the pinned package.json carry the stack", () => {
    const repo = buildPrompt(withRepo()).text
    expect(repo).toContain("pins the stack in its `package.json`")
    expect(repo).not.toContain("Next.js 16 with the App Router; server components by default")
  })

  it("still carries the product itself — screens, journeys and design", () => {
    // The whole point: what moves to the repo is the boilerplate, never the brief.
    const doc = withRepo()
    const text = buildPrompt(doc).text
    expect(text).toContain(doc.screens[0].title)
    expect(text).toContain("Design language")
    // The claude-code target renders block titles as XML tags, so this checks
    // the journeys are present rather than the heading above them.
    expect(text).toContain("<flows>")
    expect(text).toContain(doc.flows[0].name)
  })

  it("is shorter than writing it all out", () => {
    const scratch = buildPrompt(fromScratch()).text.length
    const repo = buildPrompt(withRepo()).text.length
    expect(repo).toBeLessThan(scratch)
  })

  it("appears in every target, right after the overview", () => {
    for (const target of promptTargets) {
      const index = target.order.indexOf("boilerplate")
      expect(index).toBeGreaterThan(-1)
      expect(target.order[index - 1]).toBe("overview")
    }
  })

  it("tells the agent to delete the example feature", () => {
    expect(buildPrompt(withRepo()).text).toContain("features/example/")
  })
})

describe("the boilerplate only applies where it fits", () => {
  const withFramework = (framework: string) => {
    const base = withRepo()
    return { ...base, stack: { ...base.stack, framework } }
  }

  it("clones for the Next 16 stack it actually is", () => {
    expect(usesBoilerplate(withFramework("next-16"))).toBe(true)
    expect(buildPrompt(withFramework("next-16")).text).toContain("git clone")
  })

  it("does not tell a Vite project to clone a Next app", () => {
    const doc = withFramework("vite-react")
    expect(usesBoilerplate(doc)).toBe(false)
    expect(buildPrompt(doc).text).not.toContain("git clone")
  })

  it("does not tell a Remix project to clone a Next app", () => {
    expect(usesBoilerplate(withFramework("remix"))).toBe(false)
  })

  it("declines Next 15 too — the repo is a Next 16 app with proxy.ts", () => {
    expect(usesBoilerplate(withFramework("next-15"))).toBe(false)
  })

  it("falls back to the full stack and structure rather than saying nothing", () => {
    // The failure that matters: a Vite brief that has neither a clone nor a
    // folder tree is a brief with no starting point at all.
    const { text } = buildPrompt(withFramework("vite-react"))
    expect(text).toContain("Use this folder structure")
    expect(text).toContain("Files and folders are kebab-case")
  })

  it("warns rather than silently ignoring the switch", () => {
    const { warnings } = buildPrompt(withFramework("vite-react"))
    expect(warnings.join(" ")).toContain("does not fit")
  })

  it("stays quiet when the stack and the switch agree", () => {
    const { warnings } = buildPrompt(withFramework("next-16"))
    expect(warnings.join(" ")).not.toContain("does not fit")
  })

  it("says nothing about fit when the project opted out entirely", () => {
    const doc = { ...fromScratch(), stack: { ...base().stack, framework: "vite-react" } }
    expect(buildPrompt(doc).warnings.join(" ")).not.toContain("does not fit")
  })
})

describe("the pinned commit is not a vulnerable Next", () => {
  it("ships a release above the CVE-2025-66478 floor", () => {
    const floor = nextVersionFloors["next-16"].min.split(".").map(Number)
    const shipped = BOILERPLATE.nextVersion.split(".").map(Number)
    expect(shipped.length).toBe(3)
    // Lexicographic on the numeric triple — 16.2.6 must not sort below 16.0.7.
    expect(
      shipped[0] > floor[0] ||
        (shipped[0] === floor[0] &&
          (shipped[1] > floor[1] || (shipped[1] === floor[1] && shipped[2] >= floor[2])))
    ).toBe(true)
  })

  it("tells the agent not to downgrade it", () => {
    const text = buildPrompt(withRepo()).text
    expect(text).toContain(BOILERPLATE.nextVersion)
    expect(text).toContain("Do not downgrade")
  })
})
