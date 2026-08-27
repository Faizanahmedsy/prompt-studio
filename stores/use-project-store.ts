"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { isReadOnly, isTransientProject } from "@/features/cloud/read-only"
import { starterDoc } from "@/features/library/data/starters"
import { builtInProfiles } from "@/features/stack/data/profiles"
import { uid } from "@/lib/utils"
import { useAuthStore } from "@/stores/use-auth-store"
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
  /**
   * A machine write, not a person's edit: the initial load, and a document
   * arriving from a colleague over the socket. These must still apply while
   * the document is read-only — a viewer watching a live project has to see
   * the changes — so they say so explicitly rather than the guard trying to
   * infer intent from `silent`.
   */
  system?: boolean
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
  /**
   * Has this browser ever held a project?
   *
   * The studio creates a starter on first run so nobody lands on a blank page.
   * That check used to be "are there no projects", which cannot tell a first
   * run from someone who has just deleted their last one — so deleting the
   * last project recreated it a second later, and synced the replacement up as
   * a brand new row. Delete looked broken when it had worked perfectly.
   *
   * Persisted, and never cleared by a delete: emptiness after a deliberate
   * delete is a state the app has to be able to show.
   */
  seeded: boolean

  markHydrated: () => void
  createProject: (
    starterId?: string,
    name?: string,
    /**
     * Applied to the starter before it becomes a project.
     *
     * The new-project dialog asks which builds this product ships and what the
     * service is written in, and those answers have to be in the document from
     * the first render — setting them afterwards would put an "untitled web
     * project" into the version history of every project that is not one.
     */
    patch?: (doc: ProjectDoc) => void
  ) => string
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

  saveVersion: (label: string, kind?: Snapshot["kind"]) => void
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

/**
 * The display name of whoever is signed in, or "" when nobody is.
 *
 * Read through `getState` on the module the auth store already exports rather
 * than imported at the top: the auth store tears down project state on sign
 * out, and importing it here the other way round would close the loop.
 */
function authorName(): string {
  try {
    const user = useAuthStore.getState().user
    return user?.full_name?.trim() || user?.email || ""
  } catch {
    return ""
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
      seeded: false,

      markHydrated: () => set({ hydrated: true }),

      createProject: (starterId = "blank", name, patch) => {
        const doc = starterDoc(starterId) ?? projectDocSchema.parse({})
        patch?.(doc)
        const project = newProject(doc, name)
        set((state) => ({
          projects: [project, ...state.projects],
          activeId: project.id,
          seeded: true,
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
          // An import — including the first pull from the server — counts as
          // having been seeded. Otherwise signing in on a new machine and
          // deleting the pulled project would summon a starter.
          seeded: true,
        }))
        return imported.id
      },

      setActive: (id) => set({ activeId: id }),

      renameProject: (id, name) => {
        if (isReadOnly(id)) return
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        }))
      },

      duplicateProject: (id) => {
        // A public viewer duplicating a stranger's diagram would persist it and
        // hand it to the sync hook, which uploads anything unsynced.
        if (isReadOnly(id)) return null
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
        // Hand-edited prompts are keyed by project id, and ids are not reused
        // — but a deleted project's drafts are dead weight in localStorage
        // that nothing would ever clear.
        void import("@/stores/use-prompt-draft-store").then(({ usePromptDraftStore }) =>
          usePromptDraftStore.getState().clearProject(id)
        )
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
        // One guard for every edit in the app. Actions, the canvas, the
        // inspectors, the command palette and the keyboard shortcuts all
        // funnel through here, so a read-only document cannot be changed by a
        // path somebody forgot to check.
        if (!options?.system && isReadOnly(id)) return
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
        // Honours the read-only guard unless the caller explicitly says this is
        // a machine write. It is NOT inherently one: "Paste Flow -> Replace
        // project" is a person, and defaulting to system here let a read-only
        // viewer overwrite the whole document.
        get().update(() => structuredClone(doc), options),

      undo: () => {
        const state = get()
        const id = state.activeId
        if (!id) return
        // Undo writes to the document directly rather than through `update`,
        // so it needs its own guard or Ctrl+Z would edit a read-only project.
        if (isReadOnly(id)) return
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
        if (isReadOnly(id)) return
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

      saveVersion: (label, kind = "manual") => {
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
              // Read at save time, from the store rather than a hook: this runs
              // outside React, and the name has to be the one that was signed
              // in when the snapshot was taken, not whoever is here later.
              by: authorName(),
              kind,
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
        // Its own check: this goes out through `replaceDoc`, which is a system
        // write and therefore not covered by the guard in `update`.
        if (isReadOnly(state.activeId)) return
        const project = state.projects.find((p) => p.id === state.activeId)
        const snapshot = project?.versions.find((v) => v.id === versionId)
        if (!snapshot) return
        get().replaceDoc(snapshot.doc)
      },

      deleteVersion: (versionId) => {
        if (isReadOnly(get().activeId)) return
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeId
              ? { ...p, versions: p.versions.filter((v) => v.id !== versionId) }
              : p
          ),
        }))
      },

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

        // `seeded` has to be carried across explicitly. This merge rebuilds the
        // state field by field, so anything not named here silently reverts to
        // its default on every reload — which for `seeded` meant the first-run
        // bootstrap firing again after a refresh and resurrecting a project
        // the person had just deleted.
        //
        // A store that already holds projects has obviously been seeded, which
        // keeps this correct for anyone upgrading from a build without the flag.
        const seeded = saved.seeded === true || projects.length > 0

        return { ...current, projects, profiles, activeId, seeded }
      },
      // History is deliberately session-scoped, and `hydrated` is runtime state.
      partialize: (state) => ({
        // A public view's project is for this page load only — persisting it
        // would leave a stranger's diagram in the viewer's own project list.
        projects: state.projects.filter((p) => !isTransientProject(p.id)),
        activeId:
          state.activeId && isTransientProject(state.activeId) ? null : state.activeId,
        profiles: state.profiles,
        seeded: state.seeded,
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
