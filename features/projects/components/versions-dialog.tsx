"use client"

import { Cloud, History, RotateCcw, Sparkles, Trash2, User, Wand2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/feedback"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { diffLines, diffStats } from "@/features/prompt/engine/diff"
import { cn, formatDate, formatTime, relativeTime } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import type { Project, ProjectDoc, Snapshot } from "@/types/project"

import { useVersions } from "../use-versions"

export function VersionsDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
}) {
  const deleteVersion = useProjectStore((s) => s.deleteVersion)
  const { rows, edits, loading, failed, shared, reload, docOf, save, restore } = useVersions(
    project,
    open
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [doc, setDoc] = useState<ProjectDoc | null>(null)

  const row = rows.find((one) => one.id === selected) ?? null

  // The document behind a server row is a second request, so it arrives after
  // the row does. Cleared on the way in, or the panel shows the previous
  // version's diff under the new version's name.
  useEffect(() => {
    let cancelled = false
    setDoc(null)
    if (!row) return
    void docOf(row).then((loaded) => {
      if (!cancelled) setDoc(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [row, docOf])

  const diff = doc ? diffLines(buildPrompt(doc).text, buildPrompt(project).text) : []
  const stats = diffStats(diff)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[80dvh] w-[min(900px,calc(100vw-1.5rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            {shared
              ? "Every version of this project, kept on the server and shared with everyone on it. Each one says who saved it."
              : "Snapshots kept in this browser. Sign in and this project syncs, and its history moves to your account where the rest of the team can see it."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => {
                void save("Saved by hand").then(() => toast.success("Version saved"))
              }}
            >
              Save current version
            </Button>
            {failed && (
              <p className="text-[10px] leading-snug text-muted-foreground">
                The server did not answer — showing this browser&rsquo;s copy.{" "}
                <button type="button" className="underline" onClick={() => void reload()}>
                  Try again
                </button>
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {rows.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setSelected(version.id)}
                  className={cn(
                    "w-full rounded-lg border p-2 text-left transition-colors",
                    selected === version.id
                      ? "border-primary bg-primary-soft/40"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <KindIcon kind={version.kind} />
                    <span className="truncate">{version.label}</span>
                    {version.source === "server" && (
                      <Cloud
                        className="ml-auto size-3 shrink-0 text-muted-foreground"
                        aria-label="Kept on the server"
                      />
                    )}
                  </span>
                  <span
                    className="block text-[10px] text-muted-foreground"
                    title={`${formatDate(version.createdAt)} ${formatTime(version.createdAt)}`}
                  >
                    {relativeTime(version.createdAt)} · {formatTime(version.createdAt)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <User className="size-3 shrink-0" aria-hidden="true" />
                    {/* Blank for anything saved signed out, or before versions
                        recorded an author at all — "Unknown" is the honest word
                        for that, and quieter than an empty gap. */}
                    <span className="truncate">{version.by || "Unknown"}</span>
                  </span>
                  {version.docVersion !== undefined && (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      Document v{version.docVersion}
                    </span>
                  )}
                </button>
              ))}
              {!rows.length && !loading && (
                <p className="px-1 py-2 text-[11px] text-muted-foreground">
                  Nothing saved yet.
                </p>
              )}
            </div>

            {/* Who has been editing, which the version list alone cannot say:
                most saves are the live socket's, and those are snapshotted on a
                timer rather than per change. */}
            {edits.length > 0 && (
              <div className="shrink-0 space-y-1 border-t border-border pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent edits
                </p>
                {edits.slice(0, 6).map((entry) => (
                  <p key={entry.id} className="text-[10px] text-muted-foreground">
                    <span className="text-foreground">{entry.by}</span> — {entry.edits}{" "}
                    {entry.edits === 1 ? "save" : "saves"}, {relativeTime(entry.at)}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border">
            {!row || !doc ? (
              <EmptyState
                icon={<History />}
                title={
                  row ? "Loading that version…" : rows.length ? "Select a version" : "No versions yet"
                }
                description={
                  rows.length
                    ? "Pick a version on the left to see what has changed since, and restore it if you want it back."
                    : "Generate a prompt or save one by hand to start the history."
                }
              />
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">
                    {stats.added === 0 && stats.removed === 0 ? (
                      "Identical to the project as it stands now"
                    ) : (
                      <>
                        Restoring this would{" "}
                        <span className="text-destructive">remove {stats.removed}</span> and{" "}
                        <span className="text-success">bring back {stats.added}</span> lines of
                        the prompt
                      </>
                    )}
                  </span>
                  <span className="flex gap-1.5">
                    {/* Only this browser's copies can be deleted. The server's
                        history is the team's, and there is no route that
                        removes one — deliberately. */}
                    {row.source === "local" && (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          deleteVersion(row.id)
                          setSelected(null)
                        }}
                      >
                        <Trash2 /> Delete
                      </Button>
                    )}
                    <Button
                      size="xs"
                      onClick={() => {
                        void restore(row).then((done) => {
                          if (!done) return
                          toast.success(`Restored “${row.label}”`, {
                            description: "Ctrl+Z puts the project back if that was wrong.",
                          })
                          onOpenChange(false)
                        })
                      }}
                    >
                      <RotateCcw /> Restore
                    </Button>
                  </span>
                </div>
                <pre className="code-surface min-h-0 flex-1 overflow-auto p-2.5">
                  {diff.map((line, index) => (
                    <div
                      key={index}
                      className={cn(
                        "whitespace-pre-wrap break-words px-1",
                        line.type === "add" && "bg-success-soft/60",
                        line.type === "del" &&
                          "bg-destructive-soft/60 text-muted-foreground line-through",
                        line.type === "same" && "text-muted-foreground/70"
                      )}
                    >
                      {line.type === "add" ? "+ " : line.type === "del" ? "− " : "  "}
                      {line.text || " "}
                    </div>
                  ))}
                </pre>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** What kind of thing this snapshot was, at a glance. */
function KindIcon({ kind }: { kind: Snapshot["kind"] }) {
  const className = "size-3 shrink-0 text-muted-foreground"
  if (kind === "generated") return <Wand2 className={className} aria-label="Generated" />
  if (kind === "auto") return <Sparkles className={className} aria-label="Taken automatically" />
  return <History className={className} aria-label="Saved by hand" />
}
