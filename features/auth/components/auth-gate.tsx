"use client"

import { Workflow } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuthStore } from "@/stores/use-auth-store"

/**
 * Everything behind the sign-in wall goes inside this.
 *
 * `status` starts as `"loading"` on purpose: on the first client paint there is
 * a token in storage but no user yet, and rendering the signed-out state in that
 * gap is the flash of login screen every app of this shape starts with. So the
 * gate renders a placeholder until the session has been resolved one way or the
 * other, and only then decides.
 *
 * This is a convenience, not the boundary. The boundary is the API, which
 * refuses every request without a valid token — a reader who disables
 * JavaScript gets an empty shell and no data.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const status = useAuthStore((s) => s.status)
  const mustChangePassword = useAuthStore((s) => s.user?.must_change_password ?? false)

  useEffect(() => {
    if (status === "anon") router.replace("/login")
  }, [status, router])

  useEffect(() => {
    // The API answers 403 to everything else until an issued password has been
    // replaced, so landing anywhere but here would be a blank screen with no
    // explanation.
    if (status === "authed" && mustChangePassword) router.replace("/set-password")
  }, [status, mustChangePassword, router])

  // "offline" gets in. A stored token that the server could not be asked about
  // is not a signed-out person — and this editor works perfectly well with no
  // network, so locking them out would be taking away work they can still do.
  const admitted = status === "authed" || status === "offline"

  if (!admitted || mustChangePassword) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <span className="flex size-10 animate-pulse items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Workflow className="size-5" />
        </span>
        <p className="text-sm">{status === "loading" ? "Signing you in…" : "Redirecting…"}</p>
      </div>
    )
  }

  return <>{children}</>
}
