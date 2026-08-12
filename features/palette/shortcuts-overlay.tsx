"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/misc"
import { useUiStore } from "@/stores/use-ui-store"

import { shortcuts } from "./use-hotkeys"

export function ShortcutsOverlay() {
  const open = useUiStore((s) => s.shortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcuts)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Single-letter shortcuts are ignored while typing in a field.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {shortcuts.map((shortcut) => (
            <li
              key={shortcut.keys}
              className="flex items-center justify-between py-1.5 text-sm"
            >
              <span>{shortcut.label}</span>
              <Kbd className="px-1.5">{shortcut.keys}</Kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
