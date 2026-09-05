"use client"

import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { TextField } from "@/components/shared/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isApiError } from "@/lib/api/client"
import type { ApiTokenSummary } from "@/lib/api/tokens"
import * as tokensApi from "@/lib/api/tokens"

/**
 * Personal API tokens — the other way into this account.
 *
 * `weaver push`, CI and curl cannot hold a session, so they carry one of these
 * instead. It has the full rights of the person who made it, which is stated on
 * screen rather than implied: there are no scopes, and a token handed to a
 * script is that person's whole account.
 *
 * The secret appears exactly once, at creation. The server keeps a fingerprint
 * and cannot show it again — so the created row stays on screen with a copy
 * button until it is dismissed, instead of being folded into the list.
 */
export function ApiTokensDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      setCreated(null)
      setCopied(false)
      return
    }
    setLoading(true)
    tokensApi
      .listTokens()
      .then(setTokens)
      .catch((failure) =>
        toast.error(isApiError(failure) ? failure.message : "Could not load your tokens")
      )
      .finally(() => setLoading(false))
  }, [open])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const token = await tokensApi.createToken(name.trim())
      setCreated({ name: token.name, token: token.token })
      setTokens((current) => [
        { id: token.id, name: token.name, created_at: token.created_at, revoked_at: null },
        ...current,
      ])
      setName("")
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : "Could not create that token")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(token: ApiTokenSummary) {
    try {
      await tokensApi.revokeToken(token.id)
      // Kept in the list, marked revoked: it is an audit trail, and a row
      // vanishing is how you end up unsure whether you revoked the right one.
      setTokens((current) =>
        current.map((row) =>
          row.id === token.id ? { ...row, revoked_at: new Date().toISOString() } : row
        )
      )
      toast.success(`“${token.name}” revoked`)
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : "Could not revoke that token")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API tokens</DialogTitle>
          <DialogDescription>
            For scripts that cannot sign in — <code>weaver push</code>, CI, curl. A token has
            the same rights you do, so treat it like your password and give each machine its
            own.
          </DialogDescription>
        </DialogHeader>

        {created && (
          <div className="space-y-2 rounded-lg border border-primary/40 bg-primary-soft/40 p-3">
            <p className="text-xs font-medium">
              “{created.name}” — copy it now. This is the only time it is shown.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-card px-2 py-1.5 font-mono text-[11px]">
                {created.token}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(created.token).then(
                    () => setCopied(true),
                    () => toast.error("Could not copy — select the token and copy it by hand")
                  )
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={create} className="flex items-end gap-2">
          <TextField
            label="New token"
            required
            maxLength={80}
            placeholder="laptop, CI, weaver"
            className="flex-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Create
          </Button>
        </form>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {loading && <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />}
          {!loading && !tokens.length && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No tokens yet.
            </p>
          )}
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{token.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {token.revoked_at
                    ? `Revoked ${new Date(token.revoked_at).toLocaleDateString()}`
                    : `Created ${new Date(token.created_at).toLocaleDateString()}`}
                </p>
              </div>
              {!token.revoked_at && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Revoke ${token.name}`}
                  onClick={() => void revoke(token)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
