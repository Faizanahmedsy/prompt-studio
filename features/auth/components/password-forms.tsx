"use client"

import { CheckCircle2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { TextField } from "@/components/shared/form"
import { Button } from "@/components/ui/button"
import { AuthError } from "@/features/auth/components/auth-error"
import { AuthLink, AuthShell } from "@/features/auth/components/auth-shell"
import * as authApi from "@/lib/api/auth"
import { isApiError } from "@/lib/api/client"
import { useAuthStore } from "@/stores/use-auth-store"

function messageOf(error: unknown): string {
  if (isApiError(error)) return error.message
  return "Something went wrong"
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await authApi.forgotPassword({ email })
      setSent(true)
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }

  // The server answers identically whether or not the address has an account,
  // and so does this screen — saying "no such account" would turn the form into
  // a way to test which addresses are registered.
  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`If ${email} has an account, a reset link is on its way.`}>
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
          The link expires in 30 minutes. Nothing has changed on the account until you use it.
        </p>
        <div className="mt-4 text-center text-xs">
          <AuthLink href="/login">Back to sign in</AuthLink>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link. It works once, and only for half an hour."
      footer={<AuthLink href="/login">Back to sign in</AuthLink>}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthError message={error} />
        <Button type="submit" disabled={busy || !email}>
          {busy ? "Sending…" : "Send the link"}
        </Button>
      </form>
    </AuthShell>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await authApi.resetPassword({ token, new_password: password })
      router.push("/login")
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="That link is incomplete"
        subtitle="Reset links carry a token. Open the one in your email, or ask for a new one."
        footer={<AuthLink href="/forgot-password">Request a new link</AuthLink>}
      >
        <div />
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" footer={<AuthLink href="/login">Back to sign in</AuthLink>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          hint="At least 8 characters, with a letter and a number."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <AuthError message={error} />
        <Button type="submit" disabled={busy || password.length < 8}>
          {busy ? "Saving…" : "Set the password"}
        </Button>
      </form>
    </AuthShell>
  )
}

/**
 * The screen an account created by an administrator lands on.
 *
 * It is not a courtesy: the API refuses every other authenticated route until
 * the issued password has been replaced, so without this screen the account can
 * sign in and reach nothing.
 */
export function SetInitialPasswordForm() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user && !user.must_change_password) router.replace("/")
  }, [user, router])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await authApi.setInitialPassword({ new_password: password })
      setUser(await authApi.getMe())
      router.push("/")
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Set your own password"
      subtitle="The password you were sent was issued to you, not chosen by you. Replace it and the rest of the app opens up."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          hint="At least 8 characters, with a letter and a number."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <AuthError message={error} />
        <Button type="submit" disabled={busy || password.length < 8}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  )
}

export function VerifyEmailScreen() {
  const token = useSearchParams().get("token") ?? ""
  const [state, setState] = useState<"working" | "done" | "failed">("working")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setState("failed")
      setError("That link is incomplete — open the one in your email.")
      return
    }
    authApi
      .verifyEmail({ token })
      .then(() => setState("done"))
      .catch((failure) => {
        setState("failed")
        setError(messageOf(failure))
      })
  }, [token])

  return (
    <AuthShell
      title={
        state === "working"
          ? "Confirming…"
          : state === "done"
            ? "Email confirmed"
            : "That link did not work"
      }
      subtitle={
        state === "done" ? "Thanks — your address is verified." : (error ?? undefined)
      }
      footer={<AuthLink href="/">Go to your projects</AuthLink>}
    >
      <div />
    </AuthShell>
  )
}
