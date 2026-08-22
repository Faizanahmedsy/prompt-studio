"use client"

import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  History,
  Link2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/feedback"
import { TextField } from "@/components/shared/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { starters } from "@/features/library/data/starters"
import { copyText, downloadFile } from "@/lib/download"
import { encodeShare, shareUrl } from "@/lib/share-codec"
import { relativeTime } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import {
  type Project,
  projectFileSchema,
  SCHEMA_VERSION,
} from "@/types/project"

import { VersionsDialog } from "./versions-dialog"

export function ProjectMenu({ project }: { project: Project }) {
  const store = useProjectStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project.name)
  const [newOpen, setNewOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const exportProject = () => {
    const file = {
      kind: "prompt-studio/project" as const,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: Date.now(),
      project,
    }
    downloadFile(
      `${project.name.toLowerCase().replace(/\s+/g, "-")}.prompt-studio.json`,
      JSON.stringify(file, null, 2),
      "application/json"
    )
  }

  const importFile = async (file: File) => {
    try {
      const parsed = projectFileSchema.parse(JSON.parse(await file.text()))
      if (parsed.schemaVersion > SCHEMA_VERSION) {
        toast.error("That file was made by a newer version of Prompt Studio.", {
          description: "Update the app, then import it again.",
        })
        return
      }
      store.importProject(parsed.project, { asCopy: true })
      toast.success("Project imported")
    } catch {
      toast.error("That file isn't a Prompt Studio project.", {
        description: "Expected a .prompt-studio.json export.",
      })
    }
  }

  const share = async () => {
    const token = await encodeShare({
      kind: "prompt-studio/project",
      schemaVersion: SCHEMA_VERSION,
      project,
    })
    const url = shareUrl(token)
    if (url.length > 30000) {
      toast.error("This project is too large for a share link.", {
        description: "Export the JSON file instead.",
      })
      return
    }
    await copyText(url)
    toast.success("Share link copied", {
      description: "Everything travels inside the link — nothing is uploaded.",
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-56 gap-1.5">
            <span className="truncate font-medium">{project.name}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          <div className="max-h-52 overflow-y-auto">
            {store.projects.map((entry) => (
              <DropdownMenuItem
                key={entry.id}
                onSelect={() => store.setActive(entry.id)}
              >
                {entry.id === project.id ? (
                  <Check className="text-primary" />
                ) : (
                  <span className="size-4" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{entry.name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {relativeTime(entry.updatedAt)} · {entry.screens.length} screens
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNewOpen(true)}>
            <FilePlus2 /> New project…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setName(project.name)
              setRenaming(true)
            }}
          >
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => store.duplicateProject(project.id)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setVersionsOpen(true)}>
            <History /> Version history
            <span className="ml-auto text-[10px] text-muted-foreground">
              {project.versions.length}
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={share}>
            <Link2 /> Copy share link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportProject}>
            <Download /> Export .json
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <Upload /> Import .json
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) importFile(file)
          event.target.value = ""
        }}
      />

      {/* Rename ---------------------------------------------------------- */}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <TextField
            label="Name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) {
                store.renameProject(project.id, name.trim())
                setRenaming(false)
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                store.renameProject(project.id, name.trim())
                setRenaming(false)
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New from starter ------------------------------------------------- */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Start blank or from a template you can edit freely.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {starters.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => {
                  store.createProject(starter.id)
                  setNewOpen(false)
                  toast.success(`Created from “${starter.name}”`)
                }}
                className="rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/30"
              >
                <span className="block text-xs font-medium">{starter.name}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {starter.description}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <VersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        project={project}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${project.name}”?`}
        description="This removes the project and its version history from this browser. Export it first if you might need it."
        confirmLabel="Delete project"
        onConfirm={() => store.deleteProject(project.id)}
      />
    </>
  )
}
