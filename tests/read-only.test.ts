import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { isReadOnly, readOnlyReason, setPublicViewer } from "@/features/cloud/read-only"
import { useProjectStore } from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"

/**
 * Read-only is enforced in one place — the project store — so that no edit
 * path can forget to check. These tests drive the store rather than a
 * component for exactly that reason.
 */

const REMOTE = "srv-1"

function freshProject(): string {
  useProjectStore.setState({ projects: [], activeId: null, past: {}, future: {} })
  useSyncStore.setState({ links: {}, roles: {}, versions: {} })
  const id = useProjectStore.getState().createProject("blank", "Test")
  useProjectStore.getState().setActive(id)
  return id
}

const linkAs = (localId: string, role: "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER") =>
  useSyncStore.getState().link(localId, REMOTE, 1, role)

const nameOf = (id: string) =>
  useProjectStore.getState().projects.find((p) => p.id === id)?.name

const screenCount = (id: string) =>
  useProjectStore.getState().projects.find((p) => p.id === id)?.screens.length ?? 0

afterEach(() => setPublicViewer(false))

describe("who may edit", () => {
  beforeEach(freshProject)

  it("a project that was never synced is the person's own", () => {
    const id = useProjectStore.getState().activeId!
    expect(isReadOnly(id)).toBe(false)
    expect(readOnlyReason(id)).toBeNull()
  })

  it("an owner may edit", () => {
    const id = useProjectStore.getState().activeId!
    linkAs(id, "OWNER")
    expect(isReadOnly(id)).toBe(false)
  })

  it("an editor may edit", () => {
    const id = useProjectStore.getState().activeId!
    linkAs(id, "EDITOR")
    expect(isReadOnly(id)).toBe(false)
  })

  it("a commenter may not edit", () => {
    const id = useProjectStore.getState().activeId!
    linkAs(id, "COMMENTER")
    expect(isReadOnly(id)).toBe(true)
    expect(readOnlyReason(id)).toContain("comment")
  })

  it("a viewer may not edit", () => {
    const id = useProjectStore.getState().activeId!
    linkAs(id, "VIEWER")
    expect(isReadOnly(id)).toBe(true)
    expect(readOnlyReason(id)).toContain("view-only")
  })

  it("a public viewer may not edit anything at all", () => {
    const id = useProjectStore.getState().activeId!
    setPublicViewer(true)
    expect(isReadOnly(id)).toBe(true)
    expect(readOnlyReason(id)).toContain("shared project")
  })

  it("never locks someone out with no project on screen", () => {
    expect(isReadOnly(null)).toBe(false)
  })
})

describe("the store refuses the edit", () => {
  let id: string

  beforeEach(() => {
    id = freshProject()
    linkAs(id, "VIEWER")
  })

  it("ignores a document update", () => {
    const before = screenCount(id)
    useProjectStore.getState().update((doc) => {
      doc.screens = []
    })
    expect(screenCount(id)).toBe(before)
  })

  it("ignores a rename", () => {
    useProjectStore.getState().renameProject(id, "Renamed")
    expect(nameOf(id)).toBe("Test")
  })

  it("ignores undo, so Ctrl+Z cannot edit a locked project", () => {
    // Give it something to undo first, as an editor.
    linkAs(id, "EDITOR")
    useProjectStore.getState().update((doc) => {
      doc.name = "Edited"
    })
    const after = useProjectStore.getState().projects.find((p) => p.id === id)?.name
    linkAs(id, "VIEWER")
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().projects.find((p) => p.id === id)?.name).toBe(after)
  })

  it("ignores redo", () => {
    linkAs(id, "EDITOR")
    useProjectStore.getState().update((doc) => {
      doc.name = "Edited"
    })
    useProjectStore.getState().undo()
    const undone = nameOf(id)
    linkAs(id, "VIEWER")
    useProjectStore.getState().redo()
    expect(nameOf(id)).toBe(undone)
  })

  it("ignores restoring a version, which writes through replaceDoc", () => {
    linkAs(id, "EDITOR")
    useProjectStore.getState().saveVersion("snapshot")
    const versionId = useProjectStore.getState().projects.find((p) => p.id === id)!.versions[0].id
    useProjectStore.getState().update((doc) => {
      doc.name = "Moved on"
    })
    linkAs(id, "VIEWER")
    useProjectStore.getState().restoreVersion(versionId)
    expect(nameOf(id)).toBe("Moved on")
  })

  it("ignores deleting a version", () => {
    linkAs(id, "EDITOR")
    useProjectStore.getState().saveVersion("snapshot")
    const versionId = useProjectStore.getState().projects.find((p) => p.id === id)!.versions[0].id
    linkAs(id, "VIEWER")
    useProjectStore.getState().deleteVersion(versionId)
    expect(
      useProjectStore.getState().projects.find((p) => p.id === id)!.versions
    ).toHaveLength(1)
  })
})

describe("what read-only must not break", () => {
  it("still applies a colleague's edit arriving over the socket", () => {
    const id = freshProject()
    linkAs(id, "VIEWER")
    const incoming = {
      ...useProjectStore.getState().projects.find((p) => p.id === id)!,
      name: "From a colleague",
    }
    const { id: _i, createdAt, updatedAt, schemaVersion, versions, ...doc } = incoming
    // `system: true` is what the collaboration socket passes. A viewer
    // watching a live project has to see it change.
    useProjectStore.getState().replaceDoc(doc, { silent: true, system: true })
    expect(nameOf(id)).toBe("From a colleague")
  })

  it("refuses a replaceDoc that is NOT marked as a machine write", () => {
    // "Paste Flow -> Replace project" reaches replaceDoc from a button. When
    // replaceDoc defaulted to system:true, that was a full read-only bypass:
    // a viewer could overwrite the entire document.
    const id = freshProject()
    linkAs(id, "VIEWER")
    const before = nameOf(id)
    const current = useProjectStore.getState().projects.find((p) => p.id === id)!
    const { id: _i, createdAt, updatedAt, schemaVersion, versions, ...doc } = current
    useProjectStore.getState().replaceDoc({ ...doc, name: "Pasted over" })
    expect(nameOf(id)).toBe(before)
  })

  it("refuses to duplicate a project the viewer only has read access to", () => {
    // Duplicating writes a NEW project with a normal id, which the sync hook
    // then uploads — a stranger's diagram landing in the viewer's account.
    const id = freshProject()
    linkAs(id, "VIEWER")
    const countBefore = useProjectStore.getState().projects.length
    expect(useProjectStore.getState().duplicateProject(id)).toBeNull()
    expect(useProjectStore.getState().projects).toHaveLength(countBefore)
  })

  it("refuses to duplicate while viewing a public link", () => {
    const id = freshProject()
    setPublicViewer(true)
    const countBefore = useProjectStore.getState().projects.length
    expect(useProjectStore.getState().duplicateProject(id)).toBeNull()
    expect(useProjectStore.getState().projects).toHaveLength(countBefore)
  })

  it("lifts the moment the person switches to a project of their own", () => {
    const shared = freshProject()
    linkAs(shared, "VIEWER")
    expect(isReadOnly(shared)).toBe(true)

    const mine = useProjectStore.getState().createProject("blank", "Mine")
    useProjectStore.getState().setActive(mine)
    expect(isReadOnly(mine)).toBe(false)

    useProjectStore.getState().update((doc) => {
      doc.name = "Edited freely"
    })
    expect(nameOf(mine)).toBe("Edited freely")
  })

  it("a public viewer is locked out of every project, not just the shared one", () => {
    const mine = freshProject()
    setPublicViewer(true)
    expect(isReadOnly(mine)).toBe(true)
    useProjectStore.getState().renameProject(mine, "Nope")
    expect(nameOf(mine)).toBe("Test")
  })
})
