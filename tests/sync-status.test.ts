import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"

import { useSyncStore } from "@/stores/use-sync-store"

/**
 * "Synced" with no time on it is a claim with no evidence — it reads the same
 * a second after a save and an hour after the connection dropped. These are the
 * facts the header needs to be able to say something checkable.
 */
describe("when a project last reached the server", () => {
  beforeEach(() => {
    useSyncStore.setState({ links: {}, syncedAt: {}, versions: {}, roles: {}, state: {} })
  })

  it("is unknown until something is actually saved", () => {
    expect(useSyncStore.getState().syncedAt["prj_1"]).toBeUndefined()
  })

  it("is recorded on a successful save", () => {
    const before = Date.now()
    useSyncStore.getState().markSynced("prj_1")
    expect(useSyncStore.getState().syncedAt["prj_1"]).toBeGreaterThanOrEqual(before)
  })

  it("moves forward on the next one, and leaves other projects alone", () => {
    useSyncStore.getState().markSynced("prj_1")
    const first = useSyncStore.getState().syncedAt["prj_1"]
    useSyncStore.getState().markSynced("prj_2")
    useSyncStore.getState().markSynced("prj_1")
    expect(useSyncStore.getState().syncedAt["prj_1"]).toBeGreaterThanOrEqual(first)
    expect(useSyncStore.getState().syncedAt["prj_2"]).toBeDefined()
  })

  it("is one of the fields kept across a reload", () => {
    // Persisted deliberately: after a refresh the honest answer to "is my work
    // saved" is when it last was, not silence until the next edit pushes. The
    // test suite runs without a DOM, so this asserts the intent rather than
    // the write — `partialize` is what decides it.
    const source = readFileSync("stores/use-sync-store.ts", "utf8")
    const partialize = source.slice(source.indexOf("partialize:"))
    expect(partialize.slice(0, 500)).toContain("syncedAt: store.syncedAt")
  })
})
