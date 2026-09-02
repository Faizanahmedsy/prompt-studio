"use client"

import { useEffect, useRef } from "react"
import { modeFromSlug, viewUrl } from "@/lib/view-url"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"

/**
 * Keeps the address bar and the workbench pointing at the same thing.
 *
 * Reads once, on the way in: a link decides which tab and which project you
 * land on, and after that the store is in charge. Doing it continuously would
 * fight the person — every tab click writes the URL, and a URL watcher would
 * read that write back as an instruction.
 *
 * Writes with `history.replaceState` rather than the router. `router.replace`
 * re-renders the route, which remounts the workbench, which drops the canvas
 * viewport and every open panel — a heavy price for a cosmetic URL. And it is
 * replace, not push, because tabs are not history: twelve clicks between Web
 * and Design would otherwise take twelve presses of the back button to escape.
 */
export function useViewUrl(): void {
  const mode = useUiStore((state) => state.mode)
  const activeId = useProjectStore((state) => state.activeId)
  const hydrated = useProjectStore((state) => state.hydrated)
  const read = useRef(false)

  useEffect(() => {
    if (read.current || !hydrated) return
    read.current = true

    const url = new URL(window.location.href)
    const slug = url.pathname.split("/").filter(Boolean)[0]
    const linked = modeFromSlug(slug)
    if (linked) useUiStore.getState().setMode(linked)

    // A project id this browser has never seen is not an error — the link came
    // from somebody else's machine, and the tab in it is still worth honouring.
    const wanted = url.searchParams.get("p")
    const store = useProjectStore.getState()
    if (wanted && wanted !== store.activeId && store.projects.some((p) => p.id === wanted)) {
      store.setActive(wanted)
    }
  }, [hydrated])

  useEffect(() => {
    if (!read.current) return
    const next = viewUrl(mode, activeId)
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next)
    }
  }, [mode, activeId])
}
