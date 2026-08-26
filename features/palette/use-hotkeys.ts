"use client"

import { useHotkeys } from "react-hotkeys-hook"

import { addScreen, arrangeScreens } from "@/features/builder/utils/actions"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"

export const shortcuts = [
  { keys: "⌘K", label: "Command palette" },
  { keys: "⌘Z", label: "Undo" },
  { keys: "⌘⇧Z", label: "Redo" },
  { keys: "N", label: "New screen" },
  { keys: "A", label: "Auto-arrange canvas" },
  { keys: "1 / 2 / 3", label: "Flow / Landing / Code" },
  { keys: "[", label: "Toggle library panel" },
  { keys: "]", label: "Toggle inspector panel" },
  { keys: "⌘S", label: "Save a version" },
  { keys: "?", label: "This list" },
  { keys: "Esc", label: "Clear selection" },
]

/** Global shortcuts. Registered once, from the workbench. */
export function useWorkbenchHotkeys() {
  const ui = useUiStore()
  const store = useProjectStore()
  const options = { enableOnFormTags: false, preventDefault: true }

  useHotkeys("mod+k", () => ui.setPalette(true), { ...options, enableOnFormTags: true })
  useHotkeys("mod+z", () => store.undo(), options)
  useHotkeys("mod+shift+z, mod+y", () => store.redo(), options)
  useHotkeys("n", () => addScreen(""), options)
  useHotkeys("a", () => arrangeScreens(), options)
  useHotkeys("1", () => ui.setMode("web"), options)
  useHotkeys("2", () => ui.setMode("mobile"), options)
  useHotkeys("3", () => ui.setMode("landing"), options)
  useHotkeys("4", () => ui.setMode("backend"), options)
  useHotkeys("5", () => ui.setMode("code"), options)
  useHotkeys("[", () => ui.toggleLeft(), options)
  useHotkeys("]", () => ui.toggleRight(), options)
  useHotkeys("mod+s", () => store.saveVersion("Saved by hand", "manual"), {
    ...options,
    enableOnFormTags: true,
  })
  useHotkeys("shift+slash", () => ui.setShortcuts(true), options)
  useHotkeys("escape", () => ui.select(null), { ...options, preventDefault: false })
}
