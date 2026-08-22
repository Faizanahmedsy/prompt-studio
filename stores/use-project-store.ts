"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { starterDoc } from "@/features/library/data/starters"
import { builtInProfiles } from "@/features/stack/data/profiles"
import { uid } from "@/lib/utils"
import { useSyncStore } from "@/stores/use-sync-store"
import {
  type Project,
  type ProjectDoc,
  projectDocSchema,
  projectSchema,
  SCHEMA_VERSION,
  type Snapshot,
  type StackProfile,
} from "@/types/project"

const HISTORY_LIMIT = 50
const VERSION_LIMIT = 20

type UpdateOptions = {
  /** skip the undo stack (used for the initial hydration paths) */
  silent?: boolean
  /**
   * Successive updates sharing a key within a second collapse into one undo
   * step — so dragging a node is one Ctrl+Z, not two hundred.
   */
  coalesce?: string
}

type HistoryEntry = { doc: ProjectDoc; coalesce?: string; at: number }

type ProjectState = {
  projects: Project[]
  activeId: string | null
  profiles: StackProfile[]
  /** in-memory only — history does not survive a reload */
  past: Record<string, HistoryEntry[]>
  future: Record<string, HistoryEntry[]>
  hydrated: boolean

  markHydrated: () => void
  createProject: (starterId?: string, name?: string) => string
  importProject: (project: Project, opts?: { asCopy?: boolean }) => string
  setActive: (id: string) => void
  renameProject: (id: string, name: string) => void
  duplicateProject: (id: string) => string | null
  deleteProject: (id: string) => void

  update: (
    // `void`, not `undefined`: a mutator with a statement body that falls off
    // the end is typed `void`, and callers write exactly that. The union is
    // what lets one callback either return a new document or edit the draft in
    // place; the call site is `mutate(draft) ?? draft`.
    // biome-ignore lint/suspicious/noConfusingVoidType: see above
    mutate: (doc: ProjectDoc) => ProjectDoc | void,
    options?: UpdateOptions
  ) => void
  replaceDoc: (doc: ProjectDoc, options?: UpdateOptions) => void

  undo: () => void
  redo: () => void

  saveVersion: (label: string) => void
  restoreVersion: (versionId: string) => void
  deleteVersion: (versionId: string) => void

  saveProfile: (name: string) => void
  deleteProfile: (id: string) => void
  applyProfile: (profileId: string) => void
}

function newProject(doc: ProjectDoc, name?: string): Project {
  const now = Date.now()
  return {
    ...doc,
    name: name ?? doc.name,
    id: uid("prj"),
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    versions: [],
  }
}

function docOf(project: Project): ProjectDoc {
  const { id, createdAt, updatedAt, schemaVersion, versions, ...doc } = project
  return structuredClone(doc)
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,
      profiles: [],
      past: {},
      future: {},
      hydrated: false,

      markHydrated: () => set({ hydrated: true }),

      createProject: (starterId = "blank", name) => {
        const doc = starterDoc(starterId) ?? projectDocSchema.parse({})
        const project = newProject(doc, name)
        set((state) => ({
          projects: [project, ...state.projects],
          activeId: project.id,
        }))
        return project.id
      },

      importProject: (project, opts) => {
        const parsed = projectSchema.parse(project)
        const imported: Project = opts?.asCopy
          ? {
              ...parsed,
              id: uid("prj"),
              name: `${parsed.name} (imported)`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          : parsed
        set((state) => ({
          projects: [
            imported,
            ...state.projects.filter((p) => p.id !== imported.id),
          ],
          activeId: imported.id,
        }))
        return imported.id
      },

      setActive: (id) => set({ activeId: id }),

      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        })),

      duplicateProject: (id) => {
        const source = get().projects.find((p) => p.id === id)
        if (!source) return null
        const copy: Project = {
          ...structuredClone(source),
          id: uid("prj"),
          name: `${source.name} copy`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versions: [],
        }
        set((state) => ({
          projects: [copy, ...state.projects],
          activeId: copy.id,
        }))
        return copy.id
      },

      deleteProject: (id) => {
        // Drop the link to the server row as well, or the next pull sees a
        // project it believes is already here and never brings it back.
        useSyncStore.getState().unlink(id)
        set((state) => {
          const projects = state.projects.filter((p) => p.id !== id)
          const { [id]: _past, ...past } = state.past
          const { [id]: _future, ...future } = state.future
          return {
            projects,
            past,
            future,
            activeId:
              state.activeId === id ? (projects[0]?.id ?? null) : state.activeId,
          }
        })
      },

      update: (mutate, options) => {
        const state = get()
        const id = state.activeId
        if (!id) return
        const project = state.projects.find((p) => p.id === id)
        if (!project) return

        const before = docOf(project)
        const draft = structuredClone(before)
        const result = mutate(draft) ?? draft

        if (JSON.stringify(result) === JSON.stringify(before)) return

        const history = state.past[id] ?? []
        const last = history.at(-1)
        const coalesced =
          options?.coalesce &&
          last?.coalesce === options.coalesce &&
          Date.now() - last.at < 1000

        const nextHistory = options?.silent
          ? history
          : coalesced
            ? [...history.slice(0, -1), { ...last!, at: Date.now() }]
            : [...history, { doc: before, coalesce: options?.coalesce, at: Date.now() }]

        set({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...result, updatedAt: Date.now() } : p
          ),
          past: { ...state.past, [id]: nextHistory.slice(-HISTORY_LIMIT) },
          future: { ...state.future, [id]: [] },
        })
      },

      replaceDoc: (doc, options) =>
        get().update(() => structuredClone(doc), options),

      undo: () => {
        const state = get()
        const id = state.activeId
        if (!id) return
        const history = state.past[id] ?? []
        const entry = history.at(-1)
        if (!entry) return
        const project = state.projects.find((p) => p.id === id)
        if (!project) return
        set({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...structuredClone(entry.doc), updatedAt: Date.now() } : p
          ),
          past: { ...state.past, [id]: history.slice(0, -1) },
          future: {
            ...state.future,
            [id]: [...(state.future[id] ?? []), { doc: docOf(project), at: Date.now() }],
          },
        })
      },

      redo: () => {
        const state = get()
        const id = state.activeId
        if (!id) return
        const stackAhead = state.future[id] ?? []
        const entry = stackAhead.at(-1)
        if (!entry) return
        const project = state.projects.find((p) => p.id === id)
        if (!project) return
        set({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...structuredClone(entry.doc), updatedAt: Date.now() } : p
          ),
          past: {
            ...state.past,
            [id]: [...(state.past[id] ?? []), { doc: docOf(project), at: Date.now() }],
          },
          future: { ...state.future, [id]: stackAhead.slice(0, -1) },
        })
      },

      saveVersion: (label) => {
        const state = get()
        const id = state.activeId
        if (!id) return
        set({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const snapshot: Snapshot = {
              id: uid("ver"),
              label: label || `Version ${p.versions.length + 1}`,
              createdAt: Date.now(),
              doc: docOf(p),
            }
            return {
              ...p,
              versions: [snapshot, ...p.versions].slice(0, VERSION_LIMIT),
            }
          }),
        })
      },

      restoreVersion: (versionId) => {
        const state = get()
        const project = state.projects.find((p) => p.id === state.activeId)
        const snapshot = project?.versions.find((v) => v.id === versionId)
        if (!snapshot) return
        get().replaceDoc(snapshot.doc)
      },

      deleteVersion: (versionId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeId
              ? { ...p, versions: p.versions.filter((v) => v.id !== versionId) }
              : p
          ),
        })),

      saveProfile: (name) => {
        const state = get()
        const project = state.projects.find((p) => p.id === state.activeId)
        if (!project) return
        const profile: StackProfile = {
          id: uid("prof"),
          name,
          stack: structuredClone(project.stack),
          structure: structuredClone(project.structure),
          conventions: structuredClone(project.conventions),
        }
        set({ profiles: [...state.profiles, profile] })
      },

      deleteProfile: (id) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
        })),

      applyProfile: (profileId) => {
        const profile = [...builtInProfiles, ...get().profiles].find(
          (p) => p.id === profileId
        )
        if (!profile) return
        get().update((doc) => {
          doc.stack = structuredClone(profile.stack)
          doc.structure = structuredClone(profile.structure)
          doc.conventions = structuredClone(profile.conventions)
        })
      },
    }),
    {
      name: "ps:v1",
      // Rehydration is triggered from a client effect so the server render and
      // the first client render always agree.
      skipHydration: true,
      version: SCHEMA_VERSION,
      /**
       * Without this, a bumped version makes zustand throw the saved state away
       * — every project the user had, gone. `merge` below is what actually
       * reconciles the shape, so migration just hands the data through.
       */
      migrate: (persisted) => persisted,
      /**
       * Anything already in localStorage was written by an older build of this
       * app, which is exactly as untrusted as a pasted file: a project saved
       * before a field existed would otherwise reach components missing it and
       * take the whole render down. Parsing through the schema fills defaults
       * for new fields and drops anything unrecoverable.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ProjectState>
        const projects = Array.isArray(saved.projects)
          ? saved.projects.flatMap((entry) => {
              const parsed = projectSchema.safeParse(entry)
              return parsed.success ? [parsed.data] : []
            })
          : []
        const profiles = Array.isArray(saved.profiles)
          ? saved.profiles.filter(
              (p): p is StackProfile =>
                Boolean(p) && typeof (p as StackProfile).id === "string"
            )
          : []
        const activeId =
          typeof saved.activeId === "string" &&
          projects.some((p) => p.id === saved.activeId)
            ? saved.activeId
            : (projects[0]?.id ?? null)

        return { ...current, projects, profiles, activeId }
      },
      // History is deliberately session-scoped, and `hydrated` is runtime state.
      partialize: (state) => ({
        projects: state.projects,
        activeId: state.activeId,
        profiles: state.profiles,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    }
  )
)

export function useActiveProject() {
  return useProjectStore((state) =>
    state.projects.find((p) => p.id === state.activeId)
  )
}

export function useCanUndo() {
  return useProjectStore((state) =>
    Boolean(state.activeId && (state.past[state.activeId] ?? []).length)
  )
}

export function useCanRedo() {
  return useProjectStore((state) =>
    Boolean(state.activeId && (state.future[state.activeId] ?? []).length)
  )
}

export function allProfiles(custom: StackProfile[]) {
  return [...builtInProfiles, ...custom]
}
