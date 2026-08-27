import { roleAtLeast } from "@/lib/api/types"
import { useSyncStore } from "@/stores/use-sync-store"

/**
 * Whether the document on screen may be edited.
 *
 * Two ways to be read-only, and they are answered here rather than in the
 * components so there is one answer:
 *
 * - **A public viewer.** Someone following a shared link, with or without an
 *   account. The server never accepts a write from them; the point of the flag
 *   is that the editor does not pretend otherwise.
 * - **A member below EDITOR.** VIEWER and COMMENTER could already open a
 *   project and drag things around — the canvas let them, the save 403'd, and
 *   the only evidence was a toast. Their work then sat in localStorage looking
 *   saved. Refusing the edit is the honest version of that.
 *
 * A project with no server link at all is nobody else's, so it is editable —
 * `roleOf` answering `null` must never read as "no permission".
 */

/**
 * Id prefix for a project that exists only for this page view.
 *
 * A public link may be opened by someone who is signed in and has projects of
 * their own. Their store must not gain a copy of the shared diagram: it would
 * be written to localStorage, and — worse — the sync hook uploads every local
 * project that has no server row yet, so looking at someone else's public link
 * would silently create a duplicate of it in the viewer's own account.
 *
 * So the public view builds a project with this prefix, and the two places
 * that would otherwise let it escape — the persist `partialize` and the sync
 * upload loop — skip it.
 */
export const TRANSIENT_PREFIX = "pub_"

export function isTransientProject(id: string): boolean {
  return id.startsWith(TRANSIENT_PREFIX)
}

/** Set while a `/v/<token>` page is mounted. Module state, not React state:
 * the store guard runs outside the render tree and has to see it. */
let publicViewer = false

export function setPublicViewer(active: boolean): void {
  publicViewer = active
}

export function isPublicViewer(): boolean {
  return publicViewer
}

/** The guard the project store calls. Never throws — a false negative here
 * would lock someone out of their own work. */
export function isReadOnly(localId: string | null): boolean {
  if (publicViewer) return true
  if (!localId) return false
  try {
    const role = useSyncStore.getState().roleOf(localId)
    // Not linked to a server project — local-only, and entirely theirs.
    if (role === null) return false
    return !roleAtLeast(role, "EDITOR")
  } catch {
    return false
  }
}

/** Why the document is locked, for the banner. `null` when it is not. */
export function readOnlyReason(localId: string | null): string | null {
  if (publicViewer) return "You are viewing a shared project. Sign in and ask for access to edit it."
  if (!localId) return null
  const role = useSyncStore.getState().roleOf(localId)
  if (role === null || roleAtLeast(role, "EDITOR")) return null
  return role === "COMMENTER"
    ? "You can comment on this project, but not change it."
    : "You have view-only access to this project."
}

/**
 * The React-facing form of `isReadOnly`.
 *
 * Subscribes to the role map so the canvas re-renders when an owner changes
 * someone's access while they have the project open — the plain function is
 * for the store guard, which runs outside the render tree.
 */
export function useIsReadOnly(projectId: string | null): boolean {
  const remoteId = useSyncStore((s) => (projectId ? (s.links[projectId] ?? null) : null))
  const role = useSyncStore((s) => (remoteId ? (s.roles[remoteId] ?? null) : null))
  if (publicViewer) return true
  if (!projectId || role === null) return false
  return !roleAtLeast(role, "EDITOR")
}
