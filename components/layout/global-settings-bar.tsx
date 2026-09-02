"use client"

import { Palette, ScrollText } from "lucide-react"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RequirementsPanel } from "@/features/prompt/components/requirements-panel"
import { presetById } from "@/features/theme/data/presets"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

type Sheet = "brief" | null

/**
 * Brief applies to the whole project, not to whatever is selected, so in Easy
 * mode it sits in a floating bar over the canvas rather than in the inspector —
 * where it would read as a property of the selected screen.
 *
 * Design used to open a second editor here. It now goes to the Design tab,
 * which is the only place design is edited: two editors writing overlapping
 * fields is how a project ended up describing one design in the prompt and
 * rendering another in the preview.
 */
export function GlobalSettingsBar({ project }: { project: Project }) {
  const [open, setOpen] = useState<Sheet>(null)

  const design = describeSummary(project)

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
          <BarButton
            icon={<Palette className="size-4" />}
            label="Design"
            detail={design}
            active={false}
            onClick={() => useUiStore.getState().setMode("theme")}
          />
          <span className="h-6 w-px bg-border" />
          <BarButton
            icon={<ScrollText className="size-4" />}
            label="Brief"
            detail={`${project.snippetIds.length} pack${project.snippetIds.length === 1 ? "" : "s"}`}
            active={open === "brief"}
            onClick={() => setOpen("brief")}
          />
        </div>
      </div>

      <Dialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
      >
        <DialogContent className="flex h-[82dvh] w-[min(560px,calc(100vw-1.5rem))] max-w-none flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Brief</DialogTitle>
            <DialogDescription>
              Requirements and rules applied to the whole build.
            </DialogDescription>
          </DialogHeader>
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            <RequirementsPanel project={project} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BarButton({
  icon,
  label,
  detail,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  detail: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-left transition-colors",
        active ? "bg-primary-soft text-primary" : "hover:bg-muted"
      )}
    >
      <span className="text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold leading-tight">{label}</span>
        <span className="block truncate text-[10px] leading-tight text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  )
}

function describeSummary(project: Project) {
  // The preset, because that is what the design is now. An unknown id resolves
  // to the default rather than reading as blank.
  return presetById(project.theme?.preset ?? "").name
}
