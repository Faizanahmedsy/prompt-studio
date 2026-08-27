"use client"

import { Check, Copy, Globe, Loader2, Lock, RefreshCw, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isApiError } from "@/lib/api/client"
import * as projectsApi from "@/lib/api/projects"
import { copyText } from "@/lib/download"
import { encodeShare, projectUrl, publicUrl, shareUrl } from "@/lib/share-codec"
import type { Project } from "@/types/project"
import { SCHEMA_VERSION } from "@/types/project"

/**
 * The three ways to hand someone a project, in one place.
 *
 * They are genuinely different things, and the old single "Copy share link"
 * conflated the first two:
 *
 * 1. **Team link** — points at the project by id. Whoever opens it gets the
 *    live document with the role they were given. Useless to anyone who was
 *    not added, which is the point.
 * 2. **Public link** — read-only, no account. A capability the owner mints and
 *    can revoke.
 * 3. **Snapshot link** — the whole document inside the URL. Works with no
 *    server and no account, and lands as a frozen copy. Kept because it is the
 *    only one that still works when the API is unreachable.
 */

type LinkState = { enabled: boolean; token: string | null }

export function ShareDialog({
  project,
  remoteId,
  isOwner,
  open,
  onOpenChange,
}: {
  project: Project
  remoteId: string | null
  isOwner: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [link, setLink] = useState<LinkState>({ enabled: false, token: null })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = useCallback(async (value: string, key: string, message: string) => {
    await copyText(value)
    setCopied(key)
    toast.success(message)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600)
  }, [])

  // Only an owner may read the link state — asking as anyone else is a 403 or
  // a 404, and showing them a failing request for a control they cannot use
  // would be noise.
  useEffect(() => {
    if (!open || !remoteId || !isOwner) return
    let cancelled = false
    setLoading(true)
    projectsApi
      .getPublicLink(remoteId)
      .then((state) => {
        if (!cancelled) setLink({ enabled: state.enabled, token: state.token })
      })
      .catch(() => {
        if (!cancelled) setLink({ enabled: false, token: null })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, remoteId, isOwner])

  async function togglePublic(next: boolean) {
    if (!remoteId) return
    setBusy(true)
    try {
      const state = next
        ? await projectsApi.enablePublicLink(remoteId)
        : await projectsApi.disablePublicLink(remoteId)
      setLink({ enabled: state.enabled, token: state.token })
      if (state.enabled && state.token) {
        await copy(publicUrl(state.token), "public", "Public link copied")
      } else {
        toast.success("Public link turned off", {
          description: "Anyone still holding it now sees nothing.",
        })
      }
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : "Could not change the public link")
    } finally {
      setBusy(false)
    }
  }

  async function rotate() {
    if (!remoteId) return
    setBusy(true)
    try {
      const state = await projectsApi.rotatePublicLink(remoteId)
      setLink({ enabled: state.enabled, token: state.token })
      if (state.token) await copy(publicUrl(state.token), "public", "New public link copied")
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : "Could not replace the link")
    } finally {
      setBusy(false)
    }
  }

  async function copySnapshot() {
    const token = await encodeShare({
      kind: "prompt-studio/project",
      schemaVersion: SCHEMA_VERSION,
      project,
    })
    const url = shareUrl(token)
    if (url.length > 30000) {
      toast.error("This project is too large for a snapshot link.", {
        description: "Use the team link, or export the JSON file.",
      })
      return
    }
    await copy(url, "snapshot", "Snapshot link copied")
  }

  const CopyIcon = ({ id }: { id: string }) =>
    copied === id ? <Check className="text-success" /> : <Copy />

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{project.name}”</DialogTitle>
          <DialogDescription>
            Three different links, for three different situations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 1 — the team link ------------------------------------------- */}
          <section className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Users className="size-3.5" /> Team link
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {remoteId
                ? "Opens the live project for anyone you have added. They see your changes as you make them."
                : "Available once this project has synced to your account. Sign in to share it with your team."}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!remoteId}
              onClick={() =>
                remoteId &&
                copy(
                  projectUrl(remoteId),
                  "team",
                  "Team link copied — only people you have added can open it"
                )
              }
            >
              <CopyIcon id="team" /> Copy team link
            </Button>
          </section>

          {/* 2 — the public link ----------------------------------------- */}
          <section className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              {link.enabled ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}{" "}
              Public read-only link
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {!remoteId
                ? "Available once this project has synced to your account."
                : !isOwner
                  ? "Only an owner of this project can publish it."
                  : link.enabled
                    ? "Anyone with this link can open and read the project. They cannot change anything, and they do not need an account."
                    : "Publish a read-only view that anyone can open without an account."}
            </p>

            {remoteId && isOwner && (
              <div className="space-y-1.5">
                {loading ? (
                  <p className="flex items-center gap-1.5 py-1 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Checking…
                  </p>
                ) : link.enabled && link.token ? (
                  <>
                    <code className="block truncate rounded-md bg-muted px-2 py-1.5 text-[11px]">
                      {publicUrl(link.token)}
                    </code>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={busy}
                        onClick={() =>
                          link.token && copy(publicUrl(link.token), "public", "Public link copied")
                        }
                      >
                        <CopyIcon id="public" /> Copy
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={rotate}>
                        <RefreshCw /> New link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => togglePublic(false)}
                      >
                        Turn off
                      </Button>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      “New link” replaces this one — anyone still holding the old link loses
                      access immediately.
                    </p>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => togglePublic(true)}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Globe />} Create public link
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* 3 — the snapshot -------------------------------------------- */}
          <section className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Copy className="size-3.5" /> Snapshot link
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              The whole project travels inside the link and opens as an editable copy. Nothing is
              uploaded, and it works with no account at all — but it stops updating the moment you
              copy it.
            </p>
            <Button size="sm" variant="outline" className="w-full" onClick={copySnapshot}>
              <CopyIcon id="snapshot" /> Copy snapshot link
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
