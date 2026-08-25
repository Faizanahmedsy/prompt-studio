"use client"

import { Check, Layers, Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { addView } from "@/features/builder/utils/actions"
import { screensInView } from "@/features/builder/utils/views"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

/**
 * Switches which role's perspective the canvas is showing.
 *
 * Deliberately absent until a project defines a view: an app with one kind of
 * user should not have to think about this at all.
 */
export function ViewSwitcher({ project }: { project: Project }) {
  const activeViewId = useUiStore((s) => s.activeViewId)
  const setActiveView = useUiStore((s) => s.setActiveView)

  const active = project.views.find((v) => v.id === activeViewId) ?? null

  if (!project.views.length) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const id = addView("Admin")
          if (id) setActiveView(id)
        }}
        title="Split this flow by role — Super Admin, Admin, and so on"
      >
        <Users /> Add a role view
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={active ? "default" : "outline"}>
          {active ? <Users /> : <Layers />}
          <span className="max-w-32 truncate">
            {active ? active.name : "All views"}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          Same screens, different reach. A screen with no role tag belongs to
          every view.
        </DropdownMenuLabel>

        <ViewRow
          label="All views"
          detail={`${project.screens.length} screens — the whole app`}
          active={!activeViewId}
          onSelect={() => setActiveView(null)}
        />

        <DropdownMenuSeparator />

        {project.views.map((view) => {
          const count = screensInView(project, view.id).length
          const only = project.screens.filter((s) =>
            s.views.includes(view.id)
          ).length
          return (
            <ViewRow
              key={view.id}
              label={view.name}
              detail={`${count} screens${only ? ` · ${only} only this role` : ""}`}
              active={activeViewId === view.id}
              onSelect={() => setActiveView(view.id)}
            />
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            const id = addView(`View ${project.views.length + 1}`)
            if (id) setActiveView(id)
          }}
          className="gap-2 text-xs"
        >
          <Plus className="size-3.5" /> Add a view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ViewRow({
  label,
  detail,
  active,
  onSelect,
}: {
  label: string
  detail: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start gap-2 py-1.5">
      <Check
        className={cn("mt-0.5 size-3.5 shrink-0", !active && "opacity-0")}
      />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{label}</span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {detail}
        </span>
      </span>
    </DropdownMenuItem>
  )
}
