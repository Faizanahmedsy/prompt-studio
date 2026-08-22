"use client"

import { History, RotateCcw, Trash2 } from "lucide-react"
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
import type { Project } from "@/types/project"

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
            A version is saved every time you generate, plus whenever you save one
            by hand. The newest twenty are kept.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                saveVersion(`Manual · ${formatTime(Date.now())}`)
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
                  <span className="block truncate text-xs font-medium">
                    {version.label}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {formatDate(version.createdAt)} {formatTime(version.createdAt)} ·{" "}
                    {relativeTime(version.createdAt)}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {version.doc.screens.length} screens ·{" "}
                    {version.doc.sections.length} sections
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
                    ? "Compare it against the current project before restoring."
                    : "Generate a prompt or save one by hand to start the history."
                }
              />
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">
                    Difference from now: +{stats.added} / −{stats.removed} lines
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
                        toast.success("Version restored", {
                          description: "Undo puts it back if that was wrong.",
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
