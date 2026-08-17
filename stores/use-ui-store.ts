"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * The tabs. Three of them are *surfaces* — separate builds of the same product,
 * each with its own screens and stack — plus the landing page and the raw Flow
 * source. `"flow"` is kept as an alias for `"web"` so a persisted preference
 * from before surfaces existed still lands somewhere sensible.
 */
export type WorkMode = "web" | "mobile" | "backend" | "landing" | "code"

/**
 * Easy keeps only what a dev needs to draw screens and get a prompt out —
 * roughly the surface of the tool this replaced. Advanced adds the stack,
 * conventions, Flow source, diffs and versions.
 */
export type Experience = "easy" | "advanced"

type UiState = {
  experience: Experience
  setExperience: (experience: Experience) => void
  mode: WorkMode
  leftOpen: boolean
  rightOpen: boolean
  /** id of the screen or section being inspected */
  selectedId: string | null
  paletteOpen: boolean
  shortcutsOpen: boolean
  /**
   * Screens whose modules are showing. Modules are hidden by default so the
   * canvas reads the same as it always did; this is view state, so it lives
   * here rather than in the project — expanding a screen must not dirty undo,
   * the version diff or the generated prompt.
   */
  expandedScreenIds: string[]
  /**
   * Measured height of each screen card, reported by the node itself. The
   * module rows are positioned from this — a hardcoded height put them on top
   * of the card, because the card's real height depends on its thumbnail,
   * title and footer.
   */
  cardHeights: Record<string, number>
  /**
   * Which role view the canvas is filtered to; null = the whole app. View
   * state, not project state — two people can look at the same project through
   * different roles.
   */
  activeViewId: string | null
  /** show only screens explicitly tagged for the active view */
  viewStrict: boolean

  setMode: (mode: WorkMode) => void
  toggleLeft: () => void
  toggleRight: () => void
  select: (id: string | null) => void
  setPalette: (open: boolean) => void
  setShortcuts: (open: boolean) => void
  toggleScreenExpanded: (id: string) => void
  setExpandedScreens: (ids: string[]) => void
  reportCardHeight: (id: string, height: number) => void
  setActiveView: (id: string | null) => void
  setViewStrict: (strict: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      experience: "easy",
      // Leaving advanced mode must not strand the user on a hidden surface.
      setExperience: (experience) =>
        set((s) => ({
          experience,
          mode: experience === "easy" && s.mode === "code" ? "web" : s.mode,
        })),
      mode: "web",
      leftOpen: true,
      rightOpen: true,
      selectedId: null,
      paletteOpen: false,
      shortcutsOpen: false,
      expandedScreenIds: [],
      cardHeights: {},
      activeViewId: null,
      viewStrict: false,

      // "flow" was the old name for the web surface.
      setMode: (mode) => set({ mode: (mode as string) === "flow" ? "web" : mode }),
      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      select: (selectedId) => set({ selectedId }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
      setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
      toggleScreenExpanded: (id) =>
        set((s) => ({
          expandedScreenIds: s.expandedScreenIds.includes(id)
            ? s.expandedScreenIds.filter((value) => value !== id)
            : [...s.expandedScreenIds, id],
        })),
      setExpandedScreens: (expandedScreenIds) => set({ expandedScreenIds }),
      setActiveView: (activeViewId) => set({ activeViewId }),
      setViewStrict: (viewStrict) => set({ viewStrict }),
      // Sub-pixel jitter from a resize observer must not loop the canvas.
      reportCardHeight: (id, height) =>
        set((s) => {
          const rounded = Math.round(height)
          if (!rounded || s.cardHeights[id] === rounded) {
            return s
          }
          return { cardHeights: { ...s.cardHeights, [id]: rounded } }
        }),
    }),
    {
      name: "ps:ui",
      skipHydration: true,
      partialize: (state) => ({
        experience: state.experience,
        mode: state.mode === "code" ? "web" : state.mode,
        leftOpen: state.leftOpen,
        rightOpen: state.rightOpen,
      }),
    }
  )
)
