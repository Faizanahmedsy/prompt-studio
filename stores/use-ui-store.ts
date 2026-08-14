"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type WorkMode = "flow" | "landing" | "code"

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

  setMode: (mode: WorkMode) => void
  toggleLeft: () => void
  toggleRight: () => void
  select: (id: string | null) => void
  setPalette: (open: boolean) => void
  setShortcuts: (open: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      experience: "easy",
      // Leaving advanced mode must not strand the user on a hidden surface.
      setExperience: (experience) =>
        set((s) => ({
          experience,
          mode: experience === "easy" && s.mode === "code" ? "flow" : s.mode,
        })),
      mode: "flow",
      leftOpen: true,
      rightOpen: true,
      selectedId: null,
      paletteOpen: false,
      shortcutsOpen: false,

      setMode: (mode) => set({ mode }),
      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      select: (selectedId) => set({ selectedId }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
      setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
    }),
    {
      name: "ps:ui",
      skipHydration: true,
      partialize: (state) => ({
        experience: state.experience,
        mode: state.mode,
        leftOpen: state.leftOpen,
        rightOpen: state.rightOpen,
      }),
    }
  )
)
