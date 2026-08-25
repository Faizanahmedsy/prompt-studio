import { beforeEach, describe, expect, it } from "vitest"

import { usePromptDraftStore } from "@/stores/use-prompt-draft-store"

const reset = () => usePromptDraftStore.setState({ drafts: {}, bases: {} })

describe("hand-edited prompts", () => {
  beforeEach(reset)

  it("has nothing to say until someone edits", () => {
    const { get, isStale } = usePromptDraftStore.getState()
    expect(get("p1", "web")).toBeNull()
    expect(isStale("p1", "web", "built")).toBe(false)
  })

  it("keeps an edit and hands it back", () => {
    usePromptDraftStore.getState().set("p1", "web", "mine", "built")
    expect(usePromptDraftStore.getState().get("p1", "web")).toBe("mine")
  })

  it("keeps the surfaces apart", () => {
    usePromptDraftStore.getState().set("p1", "web", "web text", "built")
    expect(usePromptDraftStore.getState().get("p1", "mobile")).toBeNull()
  })

  it("keeps the projects apart", () => {
    usePromptDraftStore.getState().set("p1", "web", "one", "built")
    expect(usePromptDraftStore.getState().get("p2", "web")).toBeNull()
  })

  it("an empty edit is still an edit, not an absence", () => {
    usePromptDraftStore.getState().set("p1", "web", "", "built")
    expect(usePromptDraftStore.getState().get("p1", "web")).toBe("")
  })

  it("reports drift once the document has moved on", () => {
    usePromptDraftStore.getState().set("p1", "web", "mine", "built v1")
    expect(usePromptDraftStore.getState().isStale("p1", "web", "built v1")).toBe(false)
    expect(usePromptDraftStore.getState().isStale("p1", "web", "built v2")).toBe(true)
  })

  it("re-editing after drift adopts the new build as the baseline", () => {
    usePromptDraftStore.getState().set("p1", "web", "mine", "built v1")
    usePromptDraftStore.getState().set("p1", "web", "mine again", "built v2")
    expect(usePromptDraftStore.getState().isStale("p1", "web", "built v2")).toBe(false)
  })

  it("resetting goes back to the build, baseline and all", () => {
    usePromptDraftStore.getState().set("p1", "web", "mine", "built")
    usePromptDraftStore.getState().clear("p1", "web")
    expect(usePromptDraftStore.getState().get("p1", "web")).toBeNull()
    expect(usePromptDraftStore.getState().bases["p1:web"]).toBeUndefined()
  })

  it("deleting a project takes every surface's draft with it, and nobody else's", () => {
    const store = usePromptDraftStore.getState()
    store.set("p1", "web", "a", "built")
    store.set("p1", "mobile", "b", "built")
    store.set("p2", "web", "c", "built")
    usePromptDraftStore.getState().clearProject("p1")
    expect(usePromptDraftStore.getState().get("p1", "web")).toBeNull()
    expect(usePromptDraftStore.getState().get("p1", "mobile")).toBeNull()
    expect(usePromptDraftStore.getState().get("p2", "web")).toBe("c")
  })
})
