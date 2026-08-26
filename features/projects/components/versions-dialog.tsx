"use client"

import { History, RotateCcw, Sparkles, Trash2, User, Wand2 } from "lucide-react"
import { useState } from "react"
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
import type { Project, Snapshot } from "@/types/project"

export function VersionsDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
}) {
  const restoreVersion = useProjectStore((s) => s.restoreVersion)
  const deleteVersion = useProjectStore((s) => s.deleteVersion)
  const saveVersion = useProjectStore((s) => s.saveVersion)
  const [selected, setSelected] = useState<string | null>(null)

  const snapshot = project.versions.find((v) => v.id === selected)
  const diff = snapshot
    ? diffLines(buildPrompt(snapshot.doc).text, buildPrompt(project).text)
    : []
  const stats = diffStats(diff)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[80dvh] w-[min(900px,calc(100vw-1.5rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            A snapshot of the whole project. One is taken every time you generate a
            prompt, whenever you save one by hand, and before a colleague&rsquo;s
            changes are merged in. The newest twenty are kept — older ones drop off.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                saveVersion("Saved by hand", "manual")
                toast.success("Version saved")
              }}
            >
              Save current version
            </Button>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {project.versions.map((version) => (
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
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {describeContents(version)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border">
            {!snapshot ? (
              <EmptyState
                icon={<History />}
                title={
                  project.versions.length
                    ? "Select a version"
                    : "No versions yet"
                }
                description={
                  project.versions.length
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
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        deleteVersion(snapshot.id)
                        setSelected(null)
                      }}
                    >
                      <Trash2 /> Delete
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => {
                        restoreVersion(snapshot.id)
                        toast.success(`Restored “${snapshot.label}”`, {
                          description: "Ctrl+Z puts the project back if that was wrong.",
                        })
                        onOpenChange(false)
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

/**
 * The shape of a version, in words.
 *
 * Screens alone read the same on every row of a project that is mostly being
 * rewired rather than added to, which is what made the old list impossible to
 * choose from. Journeys and connections move independently of screens, so
 * naming all three tells two similar snapshots apart.
 */
function describeContents(version: Snapshot): string {
  const parts = [
    `${version.doc.screens.length} screen${version.doc.screens.length === 1 ? "" : "s"}`,
    `${version.doc.flows.length} journey${version.doc.flows.length === 1 ? "" : "s"}`,
    `${version.doc.edges.length} connection${version.doc.edges.length === 1 ? "" : "s"}`,
  ]
  return parts.join(" · ")
}
