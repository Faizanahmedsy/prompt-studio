"use client"

import { MailWarning } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import * as authApi from "@/lib/api/auth"
import { useAuthStore } from "@/stores/use-auth-store"

/**
 * Says why a project somebody was invited to is not here yet.
 *
 * Sharing is by email address, and an address is only matched to an invitation
 * once the account has confirmed it — otherwise registering someone else's
 * address is enough to be handed their project. That rule is right, and on its
 * own it is baffling: you are told a project was shared with you, you sign up,
 * and the app is empty with no explanation.
 *
 * Registering through the emailed link carries a token that proves the address,
 * so the normal path never sees this. It is for the person who signed up
 * directly, which is exactly the person who would otherwise be stuck.
 */
export function VerifyEmailBanner() {
  const user = useAuthStore((state) => state.user)
  const signedIn = useAuthStore((state) => state.status === "authed")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!signedIn || !user || user.email_verified_at) return null

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-border bg-warning-soft/60 px-3 py-1.5 text-[11px] text-muted-foreground">
      <MailWarning className="size-3.5 shrink-0" />
      <span>
        Confirm <span className="text-foreground">{user.email}</span> to open projects
        shared with you. Everything else works now.
      </span>
      <button
        type="button"
        disabled={sending || sent}
        className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
        onClick={() => {
          setSending(true)
          authApi
            .resendVerification()
            .then(() => {
              setSent(true)
              toast.success("Confirmation sent", { description: `Check ${user.email}.` })
            })
            .catch(() => toast.error("Could not send that — try again in a minute"))
            .finally(() => setSending(false))
        }}
      >
        {sent ? "Sent" : sending ? "Sending…" : "Resend the email"}
      </button>
    </div>
  )
}
