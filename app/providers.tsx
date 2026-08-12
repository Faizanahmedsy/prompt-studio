"use client"

import { ThemeProvider } from "next-themes"
import { useEffect } from "react"

import { Toaster } from "@/components/ui/sonner"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"

/**
 * Both stores persist to localStorage with `skipHydration`, so rehydration is
 * triggered here — after mount — and the server render always matches the
 * first client render.
 */
function StoreHydration() {
  useEffect(() => {
    useProjectStore.persist.rehydrate()
    useUiStore.persist.rehydrate()
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <StoreHydration />
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
