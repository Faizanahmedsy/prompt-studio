"use client"

import { toast } from "sonner"
import { ToggleRow } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { countsBySurface, surfaceMeta } from "@/features/builder/utils/surfaces"
import { useProjectStore } from "@/stores/use-project-store"
import type { Project } from "@/types/project"

/**
 * What this project is building — after it was created.
 *
 * All of it was already editable, in the Brief panel, which is behind a tab in
 * the inspector in Advanced and behind a floating bar in Easy. So the answer to
 * "I picked Web and Mobile when I started, how do I add the backend now?" was
 * two clicks into a panel named after something else, and people reasonably
 * concluded it could not be changed at all.
 *
 * It is the same document either way — this is a second door onto the same
 * fields, put next to the tabs those fields control and in the project menu,
 * which is where every other project-wide decision lives.
 */
export function ScopeDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
}) {
  const update = useProjectStore((state) => state.update)
  const builds = ["web", "mobile", "backend"] as const

  const counts = countsBySurface(project)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[min(560px,calc(100vw-1.5rem))] max-w-none flex-col gap-4">
        <DialogHeader>
          <DialogTitle>What you&rsquo;re building</DialogTitle>
          <DialogDescription>
            Which builds this project ships, and how much of the system the
            generated prompt covers. Change any of it whenever you like — it only
            takes effect the next time you generate.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          <section className="space-y-2">
            <SectionLabel>Builds</SectionLabel>
            {builds.map((build) => (
              <ToggleRow
                key={build}
                variant="checkbox"
                title={`${surfaceMeta[build].label}${counts[build] ? ` · ${counts[build]} screens` : ""}`}
                description={surfaceMeta[build].hint}
                checked={project.builds[build]}
                onCheckedChange={(on) => {
                  // A product has to ship something. Turning the last one off
                  // produces a prompt with nothing in it, and the person who did
                  // it would find that out three clicks later.
                  const remaining = builds.filter(
                    (other) => (other === build ? on : project.builds[other])
                  )
                  if (!remaining.length) {
                    toast.error("A project has to build something")
                    return
                  }
                  update((doc) => {
                    doc.builds[build] = on
                  })
                }}
              />
            ))}
            {counts.mobile > 0 && !project.builds.mobile && (
              <p className="text-[11px] leading-snug text-warning">
                Mobile is switched off, so its {counts.mobile} screens are not in
                the generated prompt.
              </p>
            )}
            {counts.backend > 0 && !project.builds.backend && (
              <p className="text-[11px] leading-snug text-warning">
                Backend is switched off, so its {counts.backend} screens are not
                in the generated prompt.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <SectionLabel>How much of it</SectionLabel>
            <ToggleRow
              variant="switch"
              title="Interface first"
              description="A prototype brief: the design is chosen up front and the prompt drops the data model and the deployment section. Turn it off for a one-shot build of the whole system."
              checked={project.priority === "ui-first"}
              onCheckedChange={(on) =>
                update((doc) => {
                  doc.priority = on ? "ui-first" : "logic-first"
                })
              }
            />
            <ToggleRow
              variant="switch"
              title="Start from the boilerplate"
              description="The agent clones a pinned starter repo instead of scaffolding one, and the stack and convention sections shrink to what this product adds on top."
              checked={project.startFrom === "boilerplate"}
              onCheckedChange={(on) =>
                update((doc) => {
                  doc.startFrom = on ? "boilerplate" : "scratch"
                })
              }
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
