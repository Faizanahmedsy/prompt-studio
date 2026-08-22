"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

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
  /** server project id -> the doc_version we last agreed on */
  versions: Record<string, number>
  state: Record<string, SyncState>
  /** last failure per local project, for the badge's tooltip */
  errors: Record<string, string>
  /** false while the API is unreachable — the editor keeps working regardless */
  online: boolean
  hydrated: boolean

  markHydrated: () => void
  setOnline: (online: boolean) => void
  link: (localId: string, remoteId: string, version: number) => void
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
      versions: {},
      state: {},
      errors: {},
      online: true,
      hydrated: false,

      markHydrated: () => set({ hydrated: true }),

      setOnline: (online) => set({ online }),

      link: (localId, remoteId, version) =>
        set((store) => ({
          links: { ...store.links, [localId]: remoteId },
          versions: { ...store.versions, [remoteId]: version },
          state: { ...store.state, [localId]: "linked" },
        })),

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
      }),
      onRehydrateStorage: () => (store) => store?.markHydrated(),
    }
  )
)

export const useSyncState = (localId: string | null): SyncState | null =>
  useSyncStore((store) => (localId ? (store.state[localId] ?? null) : null))
