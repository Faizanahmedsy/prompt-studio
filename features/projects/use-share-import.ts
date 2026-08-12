"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { clearShareToken, decodeShare, readShareToken } from "@/lib/share-codec"
import { useProjectStore } from "@/stores/use-project-store"
import { SCHEMA_VERSION, projectFileSchema } from "@/types/project"

/**
 * Opens a `#s=` share link. The payload is validated through the same schema as
 * a file import — a link is untrusted input like any other — and lands as a
 * copy so the sender's project id never collides with the receiver's.
 */
export function useShareImport(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const token = readShareToken()
    if (!token) return

    let cancelled = false
    decodeShare(token)
      .then((payload) => {
        if (cancelled) return
        const file = projectFileSchema.parse(payload)
        if (file.schemaVersion > SCHEMA_VERSION) {
          toast.error("This link was made by a newer version of Prompt Studio.")
          return
        }
        useProjectStore.getState().importProject(file.project, { asCopy: true })
        toast.success("Shared project opened", {
          description: "It has been saved as a copy in this browser.",
        })
      })
      .catch(() => {
        if (!cancelled) toast.error("That share link could not be read.")
      })
      .finally(() => {
        clearShareToken()
      })

    return () => {
      cancelled = true
    }
  }, [ready])
}
