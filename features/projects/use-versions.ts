"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import * as projectsApi from "@/lib/api/projects"
import type { ProjectDocPayload } from "@/lib/api/types"
import { useAuthStore } from "@/stores/use-auth-store"
import { useProjectStore } from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"
import { type Project, projectDocSchema } from "@/types/project"

import { type EditEntry, editEntries, localRow, serverRow, sortRows, type VersionRow } from "./versions"

/**
 * The version history for one project, from the server when there is one.
 *
 * Loaded when the dialog opens rather than kept live: a history is read
 * occasionally and never while it changes under you, and polling it would put
 * a request on the wire every few seconds for a panel nobody has open.
 *
 * Falls back to the local snapshots whenever there is no server to ask — a
 * project that has never been pushed, a signed-out session, an outage. That is
 * the same rule the rest of the app follows, and it is why the local history
 * stays: it is the offline copy, not a duplicate feature.
 */
export function useVersions(project: Project, open: boolean) {
  const remoteId = useSyncStore((state) => state.links[project.id] ?? null)
  const signedIn = useAuthStore((state) => state.status === "authed")
  const shared = Boolean(remoteId) && signedIn

  const [rows, setRows] = useState<VersionRow[]>([])
  const [edits, setEdits] = useState<EditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!shared || !remoteId) {
      setRows(sortRows(project.versions.map(localRow)))
      setEdits([])
      return
    }
    setLoading(true)
    try {
      const [page, activity] = await Promise.all([
        projectsApi.listVersions(remoteId, { size: 50 }),
        projectsApi.listActivity(remoteId, { size: 50 }),
      ])
      setRows(sortRows(page.items.map(serverRow)))
      setEdits(editEntries(activity.items))
      setFailed(false)
    } catch {
      // The local snapshots are a worse answer than the server's, and a much
      // better one than an empty panel with an error in it.
      setRows(sortRows(project.versions.map(localRow)))
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [shared, remoteId, project.versions])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  /** The document behind a row, whichever side it came from. */
  const docOf = useCallback(
    async (row: VersionRow) => {
      if (row.source === "local") {
        return project.versions.find((version) => version.id === row.id)?.doc ?? null
      }
      if (!remoteId) return null
      const detail = await projectsApi.getVersion(remoteId, row.id)
      const parsed = projectDocSchema.safeParse(detail.doc)
      return parsed.success ? parsed.data : null
    },
    [project.versions, remoteId]
  )

  const save = useCallback(
    async (label: string) => {
      // Always locally: it is the offline copy, and it is what undo restores
      // from if the request never lands.
      useProjectStore.getState().saveVersion(label, "manual")
      if (!shared || !remoteId) return
      try {
        await projectsApi.saveVersion(remoteId, { label })
        await load()
      } catch {
        toast.error("Saved on this device — the server did not answer")
      }
    },
    [shared, remoteId, load]
  )

  const restore = useCallback(
    async (row: VersionRow) => {
      if (row.source === "local") {
        useProjectStore.getState().restoreVersion(row.id)
        return true
      }
      if (!remoteId) return false
      try {
        // Snapshot what is on screen first. The server takes its own snapshot,
        // but that one is of the server's document — if this browser had
        // unpushed work, it exists nowhere else.
        useProjectStore.getState().saveVersion("Before restoring a version", "auto")
        const summary = await projectsApi.restoreVersion(remoteId, row.id)
        const detail = await projectsApi.getProject(remoteId)
        const parsed = projectDocSchema.safeParse(detail.doc as ProjectDocPayload)
        if (!parsed.success) return false
        useProjectStore.getState().replaceDoc(parsed.data)
        useSyncStore.getState().setVersion(remoteId, summary.doc_version)
        return true
      } catch {
        toast.error("Could not restore that version")
        return false
      }
    },
    [remoteId]
  )

  return { rows, edits, loading, failed, shared, reload: load, docOf, save, restore }
}
