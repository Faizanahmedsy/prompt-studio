"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type WorkMode = "flow" | "landing" | "code"

type UiState = {
  mode: WorkMode
  leftOpen: boolean
  rightOpen: boolean
  panelSizes: number[]
  /** id of the screen or section being inspected */
  selectedId: string | null
  paletteOpen: boolean
  shortcutsOpen: boolean

  setMode: (mode: WorkMode) => void
  toggleLeft: () => void
  toggleRight: () => void
  setPanelSizes: (sizes: number[]) => void
  select: (id: string | null) => void
  setPalette: (open: boolean) => void
  setShortcuts: (open: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: "flow",
      leftOpen: true,
      rightOpen: true,
      panelSizes: [20, 54, 26],
      selectedId: null,
      paletteOpen: false,
      shortcutsOpen: false,

      setMode: (mode) => set({ mode }),
      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      setPanelSizes: (panelSizes) => set({ panelSizes }),
      select: (selectedId) => set({ selectedId }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
      setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
    }),
    {
      name: "ps:ui",
      skipHydration: true,
      partialize: (state) => ({
        mode: state.mode,
        leftOpen: state.leftOpen,
        rightOpen: state.rightOpen,
        panelSizes: state.panelSizes,
      }),
    }
  )
)
