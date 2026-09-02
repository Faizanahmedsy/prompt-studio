"use client"

import { useState } from "react"
import { toast } from "sonner"

import { SelectField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { surfaceMeta } from "@/features/builder/utils/surfaces"
import { starters } from "@/features/library/data/starters"
import { stackGroupMap } from "@/features/stack/data/stack-catalogue"
import { cn } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import type { Surface } from "@/types/project"

/** "logic-first" is the whole system; "ui-first" is a prototype brief. */
type Priority = "logic-first" | "ui-first"

/**
 * What this product is, before any of it is drawn.
 *
 * Which builds a product ships and what its service is written in used to be
 * discoverable only after creating a project and finding the right panel — so
 * in practice every project was a web project, and the Backend tab sat there
 * with nothing in it. Asked here, the answers reach the requirements prompt,
 * which is the thing that decides what a model writes back.
 */
/**
 * The first question, because it changes what the rest of the dialog is for.
 *
 * It is asked as "what are you building" rather than "which blocks do you
 * want" — the person answering knows whether they are making a prototype, and
 * does not yet know the prompt has blocks.
 */
const PRIORITIES: Array<{ id: Priority; label: string; hint: string }> = [
  {
    id: "logic-first",
    label: "The whole system",
    hint: "Screens, data model, backend and deployment. Best for a one-shot build.",
  },
  {
    id: "ui-first",
    label: "Interface first",
    hint: "Design chosen up front, no schema or deployment in the brief. Best for a prototype.",
  },
]

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createProject = useProjectStore((s) => s.createProject)

  const [starterId, setStarterId] = useState(starters[0]?.id ?? "blank")
  const [builds, setBuilds] = useState({ web: true, mobile: false, backend: false })
  const [priority, setPriority] = useState<Priority>("logic-first")
  const [framework, setFramework] = useState("fastapi")
  const [database, setDatabase] = useState("postgres")
  const [orm, setOrm] = useState("sqlalchemy")
  const [apiStyle, setApiStyle] = useState("rest-openapi")

  const chosen = starters.find((starter) => starter.id === starterId)
  // A product has to ship something. Turning the last one off and being handed
  // an empty brief is not a state worth allowing.
  const none = !builds.web && !builds.mobile && !builds.backend

  const create = () => {
    createProject(starterId, undefined, (doc) => {
      doc.builds = { ...builds }
      doc.priority = priority
      if (builds.backend) {
        const stack = doc.surfaces.backend.stack
        stack.framework = framework
        stack.database = database
        stack.orm = orm
        stack.apiStyle = apiStyle
        // The language follows the framework: nobody picking Django means to
        // write it in TypeScript, and a mismatch here produces a brief that
        // contradicts itself.
        stack.language = pythonFrameworks.includes(framework) ? "python" : "ts-strict"
        stack.testing = pythonFrameworks.includes(framework) ? "pytest" : "jest-supertest"
        stack.tooling = pythonFrameworks.includes(framework) ? "ruff-mypy" : "biome"
        stack.packageManager = pythonFrameworks.includes(framework) ? "uv" : "pnpm"
      }
    })
    onOpenChange(false)
    toast.success(`Created from “${chosen?.name ?? "Blank"}”`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[min(620px,calc(100vw-1.5rem))] max-w-none flex-col gap-4">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            What you are building, and what it is built with. All of it is editable
            afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
          <section className="space-y-2">
            <SectionLabel>What you are building</SectionLabel>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PRIORITIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPriority(option.id)}
                  aria-pressed={priority === option.id}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    priority === option.id
                      ? "border-primary bg-primary-soft/40"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <SectionLabel>Start from</SectionLabel>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {starters.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  onClick={() => setStarterId(starter.id)}
                  aria-pressed={starterId === starter.id}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    starterId === starter.id
                      ? "border-primary bg-primary-soft/40"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span className="block text-xs font-medium">{starter.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {starter.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <SectionLabel>Builds</SectionLabel>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Pick more than one and the generated prompt describes a single
              repository holding all of them, how they wire together, and the tests
              that prove they do.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {(["web", "mobile", "backend"] as Surface[]).map((build) => (
                <button
                  key={build}
                  type="button"
                  onClick={() => setBuilds((current) => ({ ...current, [build]: !current[build] }))}
                  aria-pressed={builds[build]}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    builds[build]
                      ? "border-primary bg-primary-soft/40"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span className="block text-xs font-medium">{surfaceMeta[build].label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {surfaceMeta[build].hint}
                  </span>
                </button>
              ))}
            </div>
            {none && (
              <p className="text-[11px] text-destructive">
                Pick at least one — a product that ships nothing has nothing to brief.
              </p>
            )}
          </section>

          {builds.backend && (
            <section className="space-y-3 border-t border-border pt-4">
              <SectionLabel>The service</SectionLabel>
              <SelectField
                label="Framework"
                value={framework}
                onValueChange={setFramework}
                options={optionsOf("framework", backendFrameworkIds)}
              />
              <SelectField
                label="Database"
                value={database}
                onValueChange={setDatabase}
                options={optionsOf("database")}
              />
              <SelectField
                label="Data access"
                value={orm}
                onValueChange={setOrm}
                options={optionsOf("orm")}
              />
              <SelectField
                label="API style"
                hint="How the apps get their types from the service."
                value={apiStyle}
                onValueChange={setApiStyle}
                options={optionsOf("apiStyle")}
              />
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={none}>
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const pythonFrameworks = ["fastapi", "django-drf"]
const backendFrameworkIds = ["fastapi", "nestjs", "express-drizzle", "django-drf"]

/** Options for one stack group, optionally narrowed to a few ids. */
function optionsOf(groupKey: string, only?: string[]) {
  const group = stackGroupMap[groupKey]
  if (!group) return []
  return group.options
    .filter((option) => !only || only.includes(option.id))
    .map((option) => ({ value: option.id, label: option.label }))
}
