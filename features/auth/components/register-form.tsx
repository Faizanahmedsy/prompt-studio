"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { TextField } from "@/components/shared/form"
import { Button } from "@/components/ui/button"
import { AuthError } from "@/features/auth/components/auth-error"
import { AuthLink, AuthShell } from "@/features/auth/components/auth-shell"
import { useAuthStore } from "@/stores/use-auth-store"

/** The server's rule, restated here so the failure is caught before a round trip. */
function weakness(password: string): string | null {
  if (password.length < 8) return "At least 8 characters."
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Needs at least one letter and one number."
  if (new TextEncoder().encode(password).length > 72)
    return "At most 72 bytes — about 72 characters."
  return null
}

export function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  // Present when this page was opened from a project invitation. Passing it
  // through proves the address was invited, so the account skips email
  // confirmation and lands straight in the project.
  const invite = params.get("invite")

  const register = useAuthStore((s) => s.register)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const problem = password ? weakness(password) : null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (problem) return
    setBusy(true)
    try {
      await register({
        email,
        password,
        full_name: fullName,
        ...(invite ? { invite_token: invite } : {}),
      })
      router.push("/")
    } catch {
      // handled by the store
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={invite ? "Accept your invitation" : "Create your account"}
      subtitle={
        invite
          ? "Sign up with the address the invitation was sent to and the project will be waiting."
          : "One account, all your flow diagrams, shared with whoever you choose."
      }
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Name"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            clearError()
            setEmail(event.target.value)
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint={problem ?? "At least 8 characters, with a letter and a number."}
          value={password}
          onChange={(event) => {
            clearError()
            setPassword(event.target.value)
          }}
        />
        <AuthError message={error} />
        <Button type="submit" disabled={busy || !email || !password || Boolean(problem)}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  )
}
