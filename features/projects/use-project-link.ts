"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { isApiError } from "@/lib/api/client"
import * as projectsApi from "@/lib/api/projects"
import { clearProjectRef, takeProjectRef } from "@/lib/share-codec"
import { uid } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"
import { type Project, projectDocSchema, SCHEMA_VERSION } from "@/types/project"

/**
 * Opens a `#p=<server id>` link.
 *
 * Unlike the `#s=` snapshot link, this one carries a *reference*: the document
 * stays on the server and the person opening it gets the live project with
 * whatever role they were given. Which means the two failure modes worth
 * getting right are "you were never added to this" and "you were added, but
 * your copy has not synced yet" — and they look identical from the URL.
 *
 * Order matters. The local link is checked first, because someone who already
 * has the project should switch to it instantly rather than wait on a request
 * that would only tell us what we knew.
 */
export function useProjectLink(ready: boolean) {
  // A ref, not state: this must run exactly once per link even though `ready`
  // and the store both change underneath it.
  const handled = useRef(false)

  useEffect(() => {
    if (!ready || handled.current) return
    const remoteId = takeProjectRef()
    if (!remoteId) return
    handled.current = true
    clearProjectRef()

    const localId = useSyncStore.getState().localIdOf(remoteId)
    if (localId) {
      const exists = useProjectStore.getState().projects.some((p) => p.id === localId)
      if (exists) {
        useProjectStore.getState().setActive(localId)
        return
      }
      // Linked to a local project that is no longer here — deleted on this
      // device while the link was in someone's chat. Fall through and refetch.
    }

    let cancelled = false
    projectsApi
      .getProject(remoteId)
      .then((detail) => {
        if (cancelled) return
        // Re-check: `useProjectSync` pulls every project the account can see,
        // and it may have claimed this one while the request above was in
        // flight. Importing now would bind a SECOND local project to the same
        // server row, and both would push to it.
        const claimed = useSyncStore.getState().localIdOf(detail.id)
        if (claimed && useProjectStore.getState().projects.some((p) => p.id === claimed)) {
          useProjectStore.getState().setActive(claimed)
          return
        }
        const parsed = projectDocSchema.safeParse(detail.doc)
        if (!parsed.success) {
          toast.error("That project could not be opened.", {
            description: "Its document was written by a different version of Prompt Studio.",
          })
          return
        }
        const now = Date.now()
        const project: Project = {
          ...parsed.data,
          id: uid("prj"),
          name: detail.name || parsed.data.name,
          createdAt: now,
          updatedAt: now,
          schemaVersion: SCHEMA_VERSION,
          versions: [],
        }
        // `asCopy: false` — this is *the* project, not a duplicate of it. A
        // copy would sync back up as a second row and the person who shared it
        // would watch their project appear twice.
        const newLocalId = useProjectStore.getState().importProject(project, { asCopy: false })
        useSyncStore
          .getState()
          .link(newLocalId, detail.id, detail.doc_version, detail.my_role ?? undefined)
        useProjectStore.getState().setActive(newLocalId)
        toast.success(`Opened “${detail.name}”`, {
          description:
            detail.my_role && detail.my_role !== "OWNER"
              ? `You have ${detail.my_role.toLowerCase()} access.`
              : undefined,
        })
      })
      .catch((failure) => {
        if (cancelled) return
        // The server answers 404 for "no such project" and for "you were never
        // added to it" alike, on purpose — it must not confirm that a project
        // exists to someone with no standing on it. So the message covers both.
        if (isApiError(failure) && failure.status === 404) {
          toast.error("You do not have access to that project.", {
            description: "Ask whoever shared it to add your email address.",
          })
          return
        }
        if (isApiError(failure) && failure.status === 401) {
          toast.error("Sign in to open that project.")
          return
        }
        toast.error("Could not open that project.", {
          description: isApiError(failure) ? failure.message : "Check your connection.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [ready])
}
