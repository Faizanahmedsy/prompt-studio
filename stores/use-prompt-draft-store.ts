"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Surface } from "@/types/project"

/**
 * Hand-edits to a generated prompt.
 *
 * The prompt is built from the document, so anything typed into it would be
 * overwritten the moment a screen moved — which is why this is a *draft* kept
 * beside the build rather than a field inside it. Two consequences follow, and
 * both are deliberate:
 *
 * - **It does not sync.** A draft is one person's wording for one hand-off, not
 *   a decision about the project. Putting it in the document would broadcast an
 *   unfinished sentence to everyone in the room and stamp it into the version
 *   history.
 * - **It is remembered per surface.** Web, mobile and backend are separate
 *   builds; an edit made to the mobile prompt has no business appearing at the
 *   top of the backend one.
 *
 * The draft is deliberately *not* invalidated when the document changes. The
 * panel surfaces the drift instead ("the build moved on") and offers to take
 * the new build, because silently discarding what someone typed is the worse
 * of the two failures.
 */

type Key = string

const keyOf = (projectId: string, surface: Surface): Key => `${projectId}:${surface}`

type PromptDraftState = {
  /** Edited prompt text, by project and surface. Absent = use the build. */
  drafts: Record<Key, string>
  /** The build the draft was started from, for detecting drift. */
  bases: Record<Key, string>

  get: (projectId: string, surface: Surface) => string | null
  /** True when the document has moved on since the draft was taken. */
  isStale: (projectId: string, surface: Surface, built: string) => boolean
  set: (projectId: string, surface: Surface, text: string, built: string) => void
  clear: (projectId: string, surface: Surface) => void
  /** Drop everything for a project — used when a project is deleted. */
  clearProject: (projectId: string) => void
}

export const usePromptDraftStore = create<PromptDraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      bases: {},

      get: (projectId, surface) => get().drafts[keyOf(projectId, surface)] ?? null,

      isStale: (projectId, surface, built) => {
        const key = keyOf(projectId, surface)
        const state = get()
        if (state.drafts[key] === undefined) return false
        return state.bases[key] !== built
      },

      set: (projectId, surface, text, built) =>
        set((state) => ({
          drafts: { ...state.drafts, [keyOf(projectId, surface)]: text },
          bases: { ...state.bases, [keyOf(projectId, surface)]: built },
        })),

      clear: (projectId, surface) =>
        set((state) => {
          const key = keyOf(projectId, surface)
          const { [key]: _draft, ...drafts } = state.drafts
          const { [key]: _base, ...bases } = state.bases
          return { drafts, bases }
        }),

      clearProject: (projectId) =>
        set((state) => {
          const prefix = `${projectId}:`
          const keep = <T,>(record: Record<string, T>) =>
            Object.fromEntries(
              Object.entries(record).filter(([key]) => !key.startsWith(prefix))
            )
          return { drafts: keep(state.drafts), bases: keep(state.bases) }
        }),
    }),
    { name: "ps:prompt-drafts", skipHydration: true }
  )
)
