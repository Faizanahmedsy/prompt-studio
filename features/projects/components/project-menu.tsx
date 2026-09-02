"use client"

import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  History,
  Layers,
  Link2,
  LogOut,
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
import { ShareDialog } from "@/features/cloud/components/share-dialog"
import { removalKind, removeProjectWithFeedback } from "@/features/cloud/remove-project"
import { downloadFile } from "@/lib/download"
import { relativeTime } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"
import {
  type Project,
  projectFileSchema,
  SCHEMA_VERSION,
} from "@/types/project"
import { NewProjectDialog } from "./new-project-dialog"

import { ScopeDialog } from "./scope-dialog"
import { VersionsDialog } from "./versions-dialog"

/** "Web + Backend", so the menu row answers the question without opening it. */
function buildNames(project: Project): string {
  const names = (["web", "mobile", "backend"] as const)
    .filter((build) => project.builds[build])
    .map((build) => build[0].toUpperCase() + build.slice(1))
  return names.join(" + ") || "nothing"
}

export function ProjectMenu({ project }: { project: Project }) {
  const store = useProjectStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project.name)
  const [newOpen, setNewOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const remoteId = useSyncStore((s) => s.links[project.id] ?? null)
  const role = useSyncStore((s) => (remoteId ? (s.roles[remoteId] ?? null) : null))
  // Recomputed on every render rather than held in state: sharing can change
  // this account's role while the menu is on screen.
  const kind = removalKind(project.id)

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
          <DropdownMenuItem onSelect={() => setScopeOpen(true)}>
            <Layers /> What you&rsquo;re building…
            <span className="ml-auto text-[10px] text-muted-foreground">
              {buildNames(project)}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setVersionsOpen(true)}>
            <History /> Version history
            <span className="ml-auto text-[10px] text-muted-foreground">
              {project.versions.length}
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSharing(true)}>
            <Link2 /> Share…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportProject}>
            <Download /> Export .json
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <Upload /> Import .json
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
            {kind === "leave" ? <LogOut /> : <Trash2 />}
            {kind === "leave" ? "Leave project" : "Delete project"}
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

      <ShareDialog
        project={project}
        remoteId={remoteId}
        // A project that has never synced has no server role; it is entirely
        // this person's, so they own it.
        isOwner={role === null || role === "OWNER"}
        open={sharing}
        onOpenChange={setSharing}
      />

      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />

      <ScopeDialog open={scopeOpen} onOpenChange={setScopeOpen} project={project} />

      <VersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        project={project}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={
          kind === "leave" ? `Leave “${project.name}”?` : `Delete “${project.name}”?`
        }
        description={
          kind === "leave"
            ? "You will lose access to it. The project stays with everybody else, and an owner can add you back."
            : "It goes to the trash for everyone on it, here and on the server. An owner can restore it."
        }
        confirmLabel={
          removing ? "Working…" : kind === "leave" ? "Leave project" : "Delete project"
        }
        // The dialog stays open when this returns false: a failed delete that
        // dismissed itself would look exactly like a successful one, right up
        // until the project came back.
        onConfirm={async () => {
          setRemoving(true)
          try {
            return await removeProjectWithFeedback(project.id, project.name)
          } finally {
            setRemoving(false)
          }
        }}
      />
    </>
  )
}
