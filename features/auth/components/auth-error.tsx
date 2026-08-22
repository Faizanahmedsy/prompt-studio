"use client"

import { AlertTriangle } from "lucide-react"

/**
 * One place every auth failure is rendered.
 *
 * The API's messages are written to be shown to a person — "Incorrect email or
 * password", "Too many sign-in attempts. Wait a few minutes" — so they are
 * displayed verbatim rather than mapped to a second set of strings that would
 * drift from the server's.
 */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
