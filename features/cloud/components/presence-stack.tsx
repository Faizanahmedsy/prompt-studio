"use client"

import { Cloud, CloudOff, RefreshCw, Users } from "lucide-react"

import { Hint } from "@/components/ui/misc"
import type { CollabMember } from "@/features/collab/use-collaboration"
import { cn, relativeTime } from "@/lib/utils"

function initials(name: string, email: string): string {
  const source = name.trim() || email
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

/**
 * Who else has this project open.
 *
 * Collapsed by person, not by connection — the server already does that, so
 * someone with three tabs is one avatar. Capped at four with a "+n", because
 * the point is "you are not alone in here", not a roll call.
 */
export function PresenceStack({
  members,
  youId,
}: {
  members: CollabMember[]
  youId?: string | null
}) {
  const others = members.filter((member) => member.user_id !== youId)
  if (!others.length) return null

  const shown = others.slice(0, 4)
  const extra = others.length - shown.length

  return (
    <div className="hidden items-center md:flex">
      <Users className="mr-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />
      <div className="flex -space-x-1.5">
        {shown.map((member) => (
          <Hint key={member.user_id} label={`${member.name || member.email} · ${member.role.toLowerCase()}`}>
            <span
              className="flex size-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
              style={{ backgroundColor: member.accent_color }}
            >
              {initials(member.name, member.email)}
            </span>
          </Hint>
        ))}
        {extra > 0 && (
          <span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
            +{extra}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * One word about whether what is on screen has reached the server.
 *
 * Deliberately quiet when everything is fine — a permanent "saved" badge is
 * noise. It only speaks up when the answer is anything other than yes.
 */
export function SyncBadge({
  status,
  conflict,
  onReload,
  signedIn = true,
  linked = true,
  syncedAt = 0,
  onResync,
}: {
  status: "idle" | "connecting" | "open" | "reconnecting" | "closed"
  conflict?: boolean
  onReload?: () => void
  /** Whether there is an account to sync to at all. */
  signedIn?: boolean
  /** Whether this project has reached the server yet. */
  linked?: boolean
  /** When the document last reached the server, as a timestamp. 0 = never. */
  syncedAt?: number
  /** Push now, for the person who wants to see it happen. */
  onResync?: () => void
}) {
  if (conflict) {
    return (
      <button
        type="button"
        onClick={onReload}
        className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
      >
        <RefreshCw className="size-3" aria-hidden="true" />
        Newer version — reload
      </button>
    )
  }

  if (status === "open") {
    return (
      <Hint
        label={
          syncedAt
            ? `Every change is on the server. Last save ${relativeTime(syncedAt)}.`
            : "Changes are saved to your account as you work"
        }
      >
        <span className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          <Cloud className="size-3.5 text-primary" aria-hidden="true" />
          {/* The time, not just the word. "Synced" alone looks identical
              whether the last save landed a second ago or before the
              connection dropped an hour back. */}
          <span className="hidden lg:inline">
            {syncedAt ? `Synced ${relativeTime(syncedAt)}` : "Synced"}
          </span>
          {onResync && (
            <button
              type="button"
              onClick={onResync}
              aria-label="Save to the server now"
              className="text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
            </button>
          )}
        </span>
      </Hint>
    )
  }

  // "Offline" was shown for three different situations — signed out, a project
  // the server has not seen yet, and an actually dropped connection — and only
  // the last one is offline. The other two look like data loss to the person
  // reading it, which is the opposite of what is happening.
  // Linked first, and deliberately: a project that has reached the server is
  // synced whatever the session currently thinks. Asking about the sign-in
  // before the link labelled a dropped connection "On this device", because
  // `/users/me` fails while offline too — the one moment the badge exists for.
  const label = linked
    ? status === "closed" || status === "idle"
      ? "Offline"
      : "Connecting…"
    : signedIn
      ? "Saving…"
      : "On this device"
  const hint = linked
    ? "Your work is saved on this device and will sync when the connection returns"
    : signedIn
      ? "Sending this project to your account for the first time"
      : "This project lives in this browser. Sign in and it syncs to your account."

  return (
    <Hint label={hint}>
      <span
        className={cn(
          "flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground",
          status === "reconnecting" && "animate-pulse"
        )}
      >
        <CloudOff className="size-3.5" aria-hidden="true" />
        {onResync && linked && (
          <button
            type="button"
            onClick={onResync}
            className="order-last font-medium text-primary underline-offset-2 hover:underline"
          >
            Retry
          </button>
        )}
        <span className="hidden lg:inline">{label}</span>
      </span>
    </Hint>
  )
}
