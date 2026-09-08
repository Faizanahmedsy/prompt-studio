"use client"

/**
 * The prompt library, on the public web.
 *
 * It was a tab inside the studio, which meant the one part of this product
 * that is useful without an account was locked behind one. It is a route of
 * its own now: no `AuthGate`, no project, no cloud hooks. The library
 * component itself never touched a project, so nothing about it had to change
 * to make this work — it only ever needed a page to live on.
 */

import { PublicHeader } from "@/features/marketing/components/public-header"
import { PromptLibrary } from "@/features/prompt-library/components/prompt-library"

export function PublicPrompts() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <PublicHeader current="prompts" />
      <div className="min-h-0 flex-1">
        <PromptLibrary />
      </div>
    </div>
  )
}
