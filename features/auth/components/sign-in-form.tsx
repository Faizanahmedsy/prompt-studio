"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { TextField } from "@/components/shared/form"
import { Button } from "@/components/ui/button"
import { AuthError } from "@/features/auth/components/auth-error"
import { AuthLink, AuthShell } from "@/features/auth/components/auth-shell"
import { STUDIO_HOME } from "@/lib/view-url"
import { useAuthStore } from "@/stores/use-auth-store"

export function SignInForm({ redirectTo = STUDIO_HOME }: { redirectTo?: string }) {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const user = await login(email, password)
      // An account still holding an admin-issued password can reach exactly one
      // route until it chooses its own; sending it anywhere else means a 403
      // and a blank screen with nothing explaining why.
      router.push(user.must_change_password ? "/set-password" : redirectTo)
    } catch {
      // `login` already put the message in the store; the form renders it.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Your projects live in your account, and are shared with the people you add to them."
      footer={
        <>
          No account yet? <AuthLink href="/register">Create one</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => {
            clearError()
            setEmail(event.target.value)
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => {
            clearError()
            setPassword(event.target.value)
          }}
        />
        <AuthError message={error} />
        <Button type="submit" disabled={busy || !email || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          <AuthLink href="/forgot-password">Forgot your password?</AuthLink>
        </p>
      </form>
    </AuthShell>
  )
}
