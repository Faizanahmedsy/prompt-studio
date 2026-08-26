import { describe, expect, it } from "vitest"

import { starterDoc } from "@/features/library/data/starters"
import { BOILERPLATE, cloneLines } from "@/features/prompt/engine/boilerplate"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { promptTargets } from "@/features/prompt/engine/targets"

const base = () => starterDoc("saas-dashboard")!
const withRepo = () => ({ ...base(), startFrom: "boilerplate" as const })

describe("starting from the boilerplate", () => {
  it("says nothing at all unless the project opted in", () => {
    // Every brief that already exists must keep generating what it generated
    // yesterday, so "scratch" is the default and produces the old prompt.
    const text = buildPrompt(base()).text
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
    const scratch = buildPrompt(base()).text
    const repo = buildPrompt(withRepo()).text
    expect(scratch).toContain("Use this folder structure")
    expect(repo).not.toContain("Use this folder structure")
  })

  it("points at CLAUDE.md instead of restating the conventions", () => {
    const repo = buildPrompt(withRepo()).text
    expect(repo).toContain("`CLAUDE.md`")
    // One of the convention lines, verbatim, from the scratch prompt.
    expect(buildPrompt(base()).text).toContain("Files and folders are kebab-case")
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
    const scratch = buildPrompt(base()).text.length
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
