"use client"

import { ThemeProvider } from "next-themes"
import { useEffect } from "react"

import { Toaster } from "@/components/ui/sonner"
import { useAuthStore } from "@/stores/use-auth-store"
import { useProjectStore } from "@/stores/use-project-store"
import { usePromptDraftStore } from "@/stores/use-prompt-draft-store"
import { useSyncStore } from "@/stores/use-sync-store"
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
    // Hand-edits to a generated prompt, which outlive a reload the same way the
    // document does — nobody expects a rewritten paragraph to vanish on F5.
    usePromptDraftStore.persist.rehydrate()
    // Without this the link between a local project and its server row never
    // loads, `hydrated` stays false, and the sync hook waits forever for a
    // signal that is not coming.
    useSyncStore.persist.rehydrate()
    // Turns a stored token back into a user, or settles on "anon". Runs on
    // every page including the signed-out ones, so a visitor who is already
    // signed in and lands on /login can be sent onwards rather than asked to
    // sign in again.
    void useAuthStore.getState().bootstrap()
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
