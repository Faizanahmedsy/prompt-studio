"use client"

import { useEffect } from "react"

/**
 * Loads the chosen faces so the preview shows the font, not the fallback.
 *
 * Without this the picker is a list of names: the preview sets
 * `font-family: "Fraunces"`, the browser has never heard of it, and every
 * choice renders in the same system stack — which is exactly the bug a person
 * would report as "the font selector does nothing".
 *
 * Links are added once per family and never removed. A stylesheet that has
 * already loaded costs nothing to keep, and removing it would re-fetch the face
 * the moment somebody went back to a font they had just tried.
 */
const loaded = new Set<string>()

export function useWebFonts(families: (string | undefined)[]): void {
  const key = families.filter(Boolean).join("|")

  useEffect(() => {
    if (typeof document === "undefined") return
    for (const family of key.split("|")) {
      if (!family || loaded.has(family)) continue
      loaded.add(family)
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = `https://fonts.googleapis.com/css2?family=${family
        .trim()
        .replace(/\s+/g, "+")}:wght@400;500;600;700&display=swap`
      document.head.appendChild(link)
    }
  }, [key])
}
