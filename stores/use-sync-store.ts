"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ProjectRole } from "@/lib/api/types"

/**
 * The bridge between a local project and its row on the server.
 *
 * Kept in its own store rather than as a field on `Project` on purpose. The
 * project document is the thing the editor edits, the thing zod validates on
 * import, the thing that goes into a `.json` export and a share link, and the
 * thing `SCHEMA_VERSION` promises about — a server id is none of those. It is
 * per-installation bookkeeping: the same project exported and imported on
 * another machine is a different local row and must link independently.
 *
 * Persisted, because the link has to survive a reload; if it did not, every
 * refresh would re-upload every project as a new one.
 */

export type SyncState = "linked" | "pushing" | "conflict" | "error" | "offline"

type SyncStore = {
  /** local project id -> server project id */
  links: Record<string, string>
  syncedAt: Record<string, number>
  /** server project id -> the doc_version we last agreed on */
  versions: Record<string, number>
  /**
   * server project id -> this account's role on it.
   *
   * Kept here because two destructive actions have to choose between
   * themselves before they are offered: an owner deletes a project, and
   * everybody else leaves it. Asking the server at the moment the menu opens
   * would put a network round trip in front of a dropdown, and getting it
   * wrong means offering someone a button that can only ever fail.
   */
  roles: Record<string, ProjectRole>
  state: Record<string, SyncState>
  /** last failure per local project, for the badge's tooltip */
  errors: Record<string, string>
  /** false while the API is unreachable — the editor keeps working regardless */
  online: boolean
  /**
   * The server project whose websocket is currently open, if any.
   *
   * There are two writers for one document — the socket, and the debounced
   * HTTP push — and they must never both be live for the same project. They
   * raced: the socket saved, the server moved to N+1, the HTTP push went out
   * still claiming N, and whichever lost was told "someone else had saved a
   * newer version". The someone else was you, in the same tab.
   *
   * So while a socket is open it owns the document, and the HTTP path stands
   * down for that project alone. It stays the writer for every other project,
   * and takes over again the moment the socket closes.
   */
  liveRemoteId: string | null
  hydrated: boolean

  markHydrated: () => void
  setOnline: (online: boolean) => void
  setLiveRemoteId: (remoteId: string | null) => void
  link: (localId: string, remoteId: string, version: number, role?: ProjectRole) => void
  /** Note that this project's document is on the server as of now. */
  markSynced: (localId: string) => void
  setRole: (remoteId: string, role: ProjectRole) => void
  /** This account's role on a local project, if it is linked and known. */
  roleOf: (localId: string) => ProjectRole | null
  unlink: (localId: string) => void
  setVersion: (remoteId: string, version: number) => void
  setState: (localId: string, state: SyncState, error?: string) => void
  remoteIdOf: (localId: string) => string | null
  localIdOf: (remoteId: string) => string | null
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      links: {},
      /**
       * When each project last reached the server, as a timestamp.
       *
       * "Synced" on its own is a claim with no evidence — it looks identical
       * whether the last save landed a second ago or before the connection
       * dropped an hour back. The time is what makes it checkable.
       */
      syncedAt: {},
      versions: {},
      roles: {},
      state: {},
      errors: {},
      online: true,
      liveRemoteId: null,
      hydrated: false,

      markHydrated: () => set({ hydrated: true }),

      setOnline: (online) => set({ online }),

      setLiveRemoteId: (liveRemoteId) => set({ liveRemoteId }),

      markSynced: (localId) =>
        set((store) => ({ syncedAt: { ...store.syncedAt, [localId]: Date.now() } })),

      link: (localId, remoteId, version, role) =>
        set((store) => ({
          links: { ...store.links, [localId]: remoteId },
          versions: { ...store.versions, [remoteId]: version },
          roles: role ? { ...store.roles, [remoteId]: role } : store.roles,
          state: { ...store.state, [localId]: "linked" },
        })),

      setRole: (remoteId, role) =>
        set((store) => ({ roles: { ...store.roles, [remoteId]: role } })),

      unlink: (localId) =>
        set((store) => {
          const links = { ...store.links }
          delete links[localId]
          return { links }
        }),

      setVersion: (remoteId, version) =>
        set((store) => ({ versions: { ...store.versions, [remoteId]: version } })),

      setState: (localId, state, error) =>
        set((store) => ({
          state: { ...store.state, [localId]: state },
          errors: { ...store.errors, [localId]: error ?? "" },
        })),

      roleOf: (localId) => {
        const remoteId = get().links[localId]
        return remoteId ? (get().roles[remoteId] ?? null) : null
      },

      remoteIdOf: (localId) => get().links[localId] ?? null,
      localIdOf: (remoteId) =>
        Object.entries(get().links).find(([, remote]) => remote === remoteId)?.[0] ?? null,
    }),
    {
      name: "ps:sync",
      version: 1,
      // Same reason as the other stores: rehydration is triggered after mount
      // so the server render and the first client render agree.
      skipHydration: true,
      partialize: (store) => ({
        links: store.links,
        versions: store.versions,
        roles: store.roles,
        // Persisted: after a reload the honest answer to "is my work saved" is
        // when it last was, not silence until the next edit happens to push.
        syncedAt: store.syncedAt,
      }),
      onRehydrateStorage: () => (store) => store?.markHydrated(),
    }
  )
)

export const useSyncState = (localId: string | null): SyncState | null =>
  useSyncStore((store) => (localId ? (store.state[localId] ?? null) : null))
