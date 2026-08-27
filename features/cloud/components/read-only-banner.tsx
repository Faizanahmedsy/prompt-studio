"use client"

import { Eye } from "lucide-react"

import { isPublicViewer, readOnlyReason } from "@/features/cloud/read-only"
import { useSyncStore } from "@/stores/use-sync-store"

/**
 * Says out loud that this document cannot be changed.
 *
 * The store already refuses the edit, which makes the app *correct*; without
 * this it is also baffling — a node that will not drag and no explanation is
 * indistinguishable from a bug. Subscribed to the role so it appears and
 * disappears with it rather than only on mount.
 */
export function ReadOnlyBanner({ projectId }: { projectId: string | null }) {
  // Subscribing to `roles` is what re-renders this when an owner changes
  // someone's access while they have the project open.
  useSyncStore((s) => (projectId ? (s.links[projectId] ?? null) : null))
  useSyncStore((s) => s.roles)

  const reason = readOnlyReason(projectId)
  if (!reason) return null

  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] text-muted-foreground">
      <Eye className="size-3.5 shrink-0" />
      <span>{reason}</span>
      {isPublicViewer() && (
        <a
          className="font-medium text-primary underline-offset-2 hover:underline"
          href="/register"
        >
          Create your own
        </a>
      )}
    </div>
  )
}
