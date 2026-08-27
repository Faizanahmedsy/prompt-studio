"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { type CollabMember, useCollaboration } from "@/features/collab/use-collaboration"
import { useAuthStore } from "@/stores/use-auth-store"
import { useProjectStore } from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"
import { type Project, type ProjectDoc, projectDocSchema, SCHEMA_VERSION } from "@/types/project"

/**
 * The active project, live.
 *
 * One socket, for the project on screen — not one per project. Everything else
 * the account can see is synced over HTTP by `useProjectSync`; holding a socket
 * open for a diagram nobody is looking at costs a connection and buys nothing.
 *
 * The echo rule is what makes this safe to wire straight into the store: the
 * server never sends a document back to whoever sent it, so applying every
 * `doc.updated` cannot overwrite what the person is typing. Their own save
 * comes back as a version number and nothing else.
 */

type Live = {
  members: CollabMember[]
  status: ReturnType<typeof useCollaboration>["status"]
  conflict: boolean
  reload: () => void
  sendCursor: (payload: unknown) => void
}

function docOf(project: Project): ProjectDoc {
  const { id, createdAt, updatedAt, schemaVersion, versions, ...doc } = project
  return doc
}

export function useLiveProject(project: Project | null): Live {
  const authed = useAuthStore((s) => s.status === "authed")
  const remoteId = useSyncStore((s) => (project ? (s.links[project.id] ?? null) : null))

  // A ref, not a dependency: the callbacks below must see the *current* project
  // without the socket tearing down and reconnecting on every keystroke.
  const current = useRef(project)
  current.current = project

  // The options object is built before `collaboration` exists, so the conflict
  // handler reaches its own `clearConflict` through a ref.
  const clearConflictRef = useRef<(() => void) | null>(null)

  /**
   * The last document this tab accepted *from someone else*.
   *
   * Applying a peer's edit replaces the store's document, which makes `project`
   * a new object, which fires the outbound effect below — so the tab that was
   * only watching sent the edit straight back. The server has no way to tell
   * that apart from a real save: it stamped the echo with *this* tab's user and
   * fanned it out, and the person who actually made the change was told someone
   * else had made it. Remembering what we applied lets the effect recognise its
   * own echo and stay quiet.
   */
  const appliedRemote = useRef<string | null>(null)

  const applyRemote = useCallback((incoming: unknown, version: number, byName: string) => {
    const local = current.current
    if (!local) return
    const parsed = projectDocSchema.safeParse(incoming)
    if (!parsed.success) return
    // `silent` keeps it out of the undo stack. Ctrl+Z is for taking back your
    // own change, and being able to undo a colleague's edit — on their screen
    // too, once it syncs back — is not an undo, it is a fight.
    appliedRemote.current = JSON.stringify(parsed.data)
    useProjectStore.getState().replaceDoc(parsed.data, { silent: true, system: true })
    if (remoteId) useSyncStore.getState().setVersion(remoteId, version)
    toast.message(`${byName} updated this project`, { duration: 2000 })
  }, [remoteId])

  const collaboration = useCollaboration({
    projectId: remoteId,
    enabled: authed && Boolean(remoteId),
    schemaVersion: SCHEMA_VERSION,

    onHello: (hello) => {
      // The greeting is authoritative — this tab may have been asleep while
      // three other people edited — but "authoritative" is not the same as
      // "safe to apply silently".
      //
      // `replaceDoc(..., { silent: true })` skips the undo stack and persist
      // rewrites localStorage underneath it, so a document edited offline and
      // never pushed used to vanish on reconnect with no trace and no Ctrl+Z.
      // Snapshotting first turns permanent loss into something restorable from
      // the versions dialog.
      const parsed = projectDocSchema.safeParse(hello.doc)
      if (parsed.success && current.current) {
        const local = JSON.stringify(docOf(current.current))
        if (local !== JSON.stringify(parsed.data)) {
          useProjectStore.getState().saveVersion("Before syncing a colleague\u2019s changes", "auto")
        }
        appliedRemote.current = JSON.stringify(parsed.data)
        useProjectStore.getState().replaceDoc(parsed.data, { silent: true, system: true })
      }
      if (remoteId) useSyncStore.getState().setVersion(remoteId, hello.doc_version)
    },

    onRemoteDoc: (doc, version, by) => applyRemote(doc, version, by.name || "Someone"),

    onConflict: (message) => {
      const parsed = projectDocSchema.safeParse(message.doc)
      if (parsed.success) {
        appliedRemote.current = JSON.stringify(parsed.data)
        useProjectStore.getState().replaceDoc(parsed.data, { silent: true, system: true })
        if (remoteId) useSyncStore.getState().setVersion(remoteId, message.doc_version)
        toast.warning("Reloaded — someone else had saved a newer version")
        // Resolved the moment it is handled. Left set, the badge stayed on
        // screen for the rest of the session and followed the user into the
        // next project they opened.
        clearConflictRef.current?.()
      }
    },

    onError: (message) => {
      if (project) useSyncStore.getState().setState(project.id, "error", message)
    },

    onAuthExpired: () => {
      void useAuthStore.getState().logout()
    },
  })

  // While this socket is open it is the only writer for this project. The HTTP
  // push stands down for it — otherwise the two of them race on the same
  // document and refuse each other's saves as stale, which reads to the person
  // dragging a node as "someone else had saved a newer version" when nobody
  // else is there.
  useEffect(() => {
    const live = collaboration.status === "open" ? remoteId : null
    useSyncStore.getState().setLiveRemoteId(live)
    return () => {
      // Only relinquish if we still hold it: another project may have taken
      // over between this effect being scheduled and being cleaned up.
      if (useSyncStore.getState().liveRemoteId === remoteId) {
        useSyncStore.getState().setLiveRemoteId(null)
      }
    }
  }, [remoteId, collaboration.status])

  // The socket and the HTTP fallback each track `doc_version`, and only the
  // socket was being told when it moved. During a socket-only outage the HTTP
  // path — by then the only writer — sent a stale `base_version` and 409'd on
  // every edit, silently, forever. One writer, one number.
  useEffect(() => {
    if (remoteId && collaboration.docVersion) {
      useSyncStore.getState().setVersion(remoteId, collaboration.docVersion)
    }
  }, [remoteId, collaboration.docVersion])

  // Local edits go out over the socket. The hook debounces, so this fires on
  // every change and sends on the trailing edge.
  useEffect(() => {
    if (!project || !remoteId || collaboration.status !== "open") return
    const outgoing = docOf(project)
    // The echo guard. Cleared rather than merely compared, so the *next* edit
    // — which really is this person's — goes out normally even though it is
    // built on top of what a colleague sent.
    if (appliedRemote.current !== null) {
      const applied = appliedRemote.current
      appliedRemote.current = null
      if (applied === JSON.stringify(outgoing)) return
    }
    collaboration.sendDoc(outgoing as unknown as Record<string, unknown>)
    // `project` is a new object on every edit, which is exactly the trigger.
  }, [project, remoteId, collaboration.status, collaboration.sendDoc])

  clearConflictRef.current = collaboration.clearConflict

  return useMemo(
    () => ({
      members: collaboration.members,
      status: collaboration.status,
      conflict: collaboration.lastConflict !== null,
      reload: collaboration.reconnect,
      sendCursor: collaboration.sendCursor,
    }),
    [
      collaboration.members,
      collaboration.status,
      collaboration.lastConflict,
      collaboration.reconnect,
      collaboration.sendCursor,
    ]
  )
}
