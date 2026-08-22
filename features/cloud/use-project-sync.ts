"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { isApiError, staleDocumentDetail } from "@/lib/api/client"
import * as projectsApi from "@/lib/api/projects"
import type { ProjectSummary } from "@/lib/api/types"
import { uid } from "@/lib/utils"
import { useAuthStore } from "@/stores/use-auth-store"
import { useProjectStore } from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"
import { type Project, type ProjectDoc, projectDocSchema, SCHEMA_VERSION } from "@/types/project"

/**
 * Keeping the local editor and the server in step.
 *
 * The design constraint is that the editor was built local-first and everything
 * — undo, the canvas, the prompt engine, the version diff — reads one Zustand
 * document. Rewriting all of that to fetch per keystroke would be a different
 * application. So the local store stays the editing surface and this hook is a
 * bridge:
 *
 *   server -> local   on sign-in, and on every remote edit over the socket
 *   local  -> server  debounced, whenever the active document changes
 *
 * That also means the app keeps working with the API down: edits land in
 * localStorage exactly as they did before, and the next successful push carries
 * them up. The alternative — blocking the editor on a network round trip —
 * would make a flaky connection feel like a broken tool.
 */

const PUSH_DEBOUNCE_MS = 800

/** Last name written to `projects.name`, so a rename is sent once, not per save. */
const lastPushedName = new Map<string, string>()

function docOf(project: Project): ProjectDoc {
  const { id, createdAt, updatedAt, schemaVersion, versions, ...doc } = project
  return doc
}

/** Pull every project this account can see, and make sure each exists locally. */
async function pullAll(): Promise<number> {
  let added = 0
  let pageNumber = 1

  // Paged, not capped. A single request for 100 was not an error anyone would
  // see — the projects past the first page were simply absent, which reads as
  // "they were deleted" rather than "we stopped asking".
  for (;;) {
    const page = await projectsApi.listProjects({
      page: pageNumber,
      size: 100,
      sort: "recent",
    })
    added += await claimPage(page.items)
    if (!page.has_next) break
    pageNumber += 1
  }
  return added
}

async function claimPage(items: ProjectSummary[]): Promise<number> {
  const sync = useSyncStore.getState()
  let added = 0
  for (const summary of items) {
    const existingLocalId = sync.localIdOf(summary.id)
    // A link whose local project has since been deleted is a dead link, not a
    // reason to skip: without this the project can never be pulled back.
    if (
      existingLocalId &&
      useProjectStore.getState().projects.some((project) => project.id === existingLocalId)
    ) {
      continue
    }

    const detail = await projectsApi.getProject(summary.id)
    // Parsed through the same schema an imported `.json` goes through: the
    // server stores whatever the editor last sent, which may have been written
    // by an older client, and `projectDocSchema` is where every field gets its
    // default.
    const doc = projectDocSchema.parse(detail.doc ?? {})
    const project: Project = {
      ...doc,
      // The document's name wins. It is what the editor edits, so taking the
      // column instead reverted every rename on the next pull.
      name: doc.name || detail.name,
      id: uid("prj"),
      createdAt: Date.parse(detail.created_at) || Date.now(),
      updatedAt: Date.parse(detail.updated_at) || Date.now(),
      schemaVersion: SCHEMA_VERSION,
      versions: [],
    }
    useProjectStore.getState().importProject(project)
    useSyncStore.getState().link(project.id, detail.id, detail.doc_version)
    added += 1
  }
  return added
}

/** Push a local project the server has never seen. */
async function createRemote(project: Project): Promise<void> {
  const created = await projectsApi.createProject({
    name: project.name,
    doc: docOf(project) as unknown as Record<string, unknown>,
    schema_version: project.schemaVersion ?? SCHEMA_VERSION,
  })
  useSyncStore.getState().link(project.id, created.id, created.doc_version)
}

async function pushDoc(localId: string, project: Project): Promise<void> {
  const sync = useSyncStore.getState()
  const remoteId = sync.remoteIdOf(localId)
  if (!remoteId) return

  sync.setState(localId, "pushing")
  try {
    // The document carries the name, but `projects.name` is what the invitation
    // email, the project list and /admin all read — so a rename has to be
    // written to the column too, or those surfaces stay permanently stale.
    if (project.name && lastPushedName.get(remoteId) !== project.name) {
      try {
        await projectsApi.updateProject(remoteId, { name: project.name })
        lastPushedName.set(remoteId, project.name)
      } catch {
        // A failed rename must not stop the document itself being saved.
      }
    }

    const saved = await projectsApi.saveDocument(remoteId, {
      doc: docOf(project) as unknown as Record<string, unknown>,
      base_version: sync.versions[remoteId],
      schema_version: project.schemaVersion ?? SCHEMA_VERSION,
    })
    useSyncStore.getState().setVersion(remoteId, saved.doc_version)
    useSyncStore.getState().setState(localId, "linked")
  } catch (failure) {
    const stale = staleDocumentDetail(failure)
    if (stale) {
      // Someone else saved while this tab was editing. The local copy is kept —
      // discarding it would throw away work nobody agreed to lose — and the
      // badge offers a reload.
      useSyncStore.getState().setState(localId, "conflict", "Someone else saved a newer version")
      return
    }
    useSyncStore
      .getState()
      .setState(localId, "error", isApiError(failure) ? failure.message : "Could not save")
  }
}

/**
 * Mount once, high in the tree. Returns nothing — everything it does shows up
 * in the two stores it bridges.
 */
export function useProjectSync(): void {
  const status = useAuthStore((s) => s.status)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const syncHydrated = useSyncStore((s) => s.hydrated)
  const projectsHydrated = useProjectStore((s) => s.hydrated)

  const pulled = useRef<string | null>(null)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const lastPushed = useRef(new Map<string, string>())

  // ── server -> local, once per sign-in ──────────────────────────────────────
  useEffect(() => {
    if (status !== "authed" || !userId) return
    if (!syncHydrated || !projectsHydrated) return
    if (pulled.current === userId) return
    pulled.current = userId

    void (async () => {
      try {
        useSyncStore.getState().setOnline(true)
        const added = await pullAll()
        if (added) toast.success(`${added} project${added === 1 ? "" : "s"} loaded from your account`)

        // Anything local that has never been uploaded goes up now — including
        // whatever the person was working on before they had an account.
        const store = useProjectStore.getState()
        for (const project of store.projects) {
          if (useSyncStore.getState().remoteIdOf(project.id)) continue
          await createRemote(project)
        }
      } catch (failure) {
        // Offline or the API is down: the editor keeps working on localStorage,
        // which is exactly what it did before any of this existed.
        useSyncStore.getState().setOnline(false)
        // Deliberately not fatal. Edits land in localStorage exactly as they did
        // before any of this existed, and the next successful pull carries them
        // up — so a flaky connection does not read as a broken tool.
        toast.error(
          isApiError(failure)
            ? `Could not reach your account — ${failure.message}`
            : "Working offline — your changes are saved on this device"
        )
      }
    })()
  }, [status, userId, syncHydrated, projectsHydrated])

  // ── local -> server, debounced per project ────────────────────────────────
  useEffect(() => {
    if (status !== "authed") return

    const flush = (project: Project) => {
      const fingerprint = JSON.stringify(docOf(project))
      if (lastPushed.current.get(project.id) === fingerprint) return
      lastPushed.current.set(project.id, fingerprint)

      const existing = timers.current.get(project.id)
      if (existing) clearTimeout(existing)
      timers.current.set(
        project.id,
        setTimeout(() => {
          timers.current.delete(project.id)
          void pushDoc(project.id, project)
        }, PUSH_DEBOUNCE_MS)
      )
    }

    const unsubscribe = useProjectStore.subscribe((state, previous) => {
      if (state.projects === previous.projects) return
      for (const project of state.projects) {
        const before = previous.projects.find((candidate) => candidate.id === project.id)
        if (before === project) continue
        flush(project)
      }
    })

    const pending = timers.current
    return () => {
      unsubscribe()
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [status])
}
