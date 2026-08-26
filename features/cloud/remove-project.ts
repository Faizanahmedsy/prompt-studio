"use client"

/**
 * Removing a project, for real.
 *
 * The store's `deleteProject` only ever emptied this browser, which was right
 * when the editor was local-first and wrong the moment projects gained a row on
 * a server. The row survived, the next pull found a project with no link, and
 * it came straight back under a new local id — so "delete" read as "flicker,
 * then reappear", and doing it twice left two copies.
 *
 * Two destructive actions live here because the choice between them is not the
 * user's to make: an owner deletes a project for everybody, and everybody else
 * leaves it. Offering the wrong one produces a button that can only fail.
 *
 * Nothing is removed locally until the server has agreed. Deleting the local
 * copy first would look decisive and then undo itself on the next pull, which
 * is precisely the bug this replaces.
 */

import { toast } from "sonner"

import { isApiError } from "@/lib/api/client"
import * as projectsApi from "@/lib/api/projects"
import { useAuthStore } from "@/stores/use-auth-store"
import { useProjectStore } from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"

export type RemoveOutcome =
  | { ok: true; scope: "local" | "server" | "left" }
  | { ok: false; reason: "offline" | "not-owner" | "failed"; message: string }

/** What the menu should offer for this project. */
export function removalKind(localId: string): "delete" | "leave" {
  const sync = useSyncStore.getState()
  if (!sync.remoteIdOf(localId)) return "delete"
  // Unknown role is treated as owner: an unsynced or freshly created project
  // is one this account made, and being wrong in that direction produces a
  // clear "not the owner" message rather than silently hiding delete from the
  // person who owns it.
  return sync.roleOf(localId) === null || sync.roleOf(localId) === "OWNER" ? "delete" : "leave"
}

export async function removeProject(localId: string): Promise<RemoveOutcome> {
  const sync = useSyncStore.getState()
  const remoteId = sync.remoteIdOf(localId)
  const authed = useAuthStore.getState().status === "authed"

  // Never synced, or signed out: there is no server copy to remove and nothing
  // that will bring it back. This is the old behaviour, and here it is correct.
  if (!remoteId || !authed) {
    forgetLocally(localId)
    return { ok: true, scope: "local" }
  }

  const leaving = removalKind(localId) === "leave"
  try {
    if (leaving) await projectsApi.leaveProject(remoteId)
    else await projectsApi.deleteProject(remoteId)
  } catch (error) {
    // Already gone on the server — someone else deleted it, or this is a
    // retry. The local copy should still go; refusing would leave a project
    // that can never be removed.
    if (isApiError(error) && error.status === 404) {
      forgetLocally(localId)
      return { ok: true, scope: leaving ? "left" : "server" }
    }
    if (isApiError(error) && (error.status === 403 || error.status === 401)) {
      return {
        ok: false,
        reason: "not-owner",
        message: "Only the owner can delete this project. You can leave it instead.",
      }
    }
    if (isApiError(error)) {
      return { ok: false, reason: "failed", message: error.message }
    }
    // A network failure, not a refusal. Removing the local copy now would
    // delete the person's work from this browser while leaving it on the
    // server, which is the worst of both.
    return {
      ok: false,
      reason: "offline",
      message: "Could not reach the server. Nothing was deleted — try again when you are back online.",
    }
  }

  forgetLocally(localId)
  return { ok: true, scope: leaving ? "left" : "server" }
}

/**
 * Drop every trace of a project from this browser.
 *
 * Order matters: unlinking before the store forgets the project would let a
 * pull racing this call re-import it as a new local row.
 */
function forgetLocally(localId: string): void {
  useProjectStore.getState().deleteProject(localId)
}

/** The menu's whole job in one call: act, then say what happened. */
export async function removeProjectWithFeedback(localId: string, name: string): Promise<boolean> {
  const result = await removeProject(localId)
  if (!result.ok) {
    toast.error(result.message)
    return false
  }
  toast.success(
    result.scope === "left" ? `Left “${name}”` : `Deleted “${name}”`,
    result.scope === "server" ? { description: "It is in the trash and can be restored." } : undefined
  )
  return true
}
