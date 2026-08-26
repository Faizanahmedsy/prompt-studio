"use client"

import { Database, KeyRound, Link2, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/feedback"
import { Button } from "@/components/ui/button"
import { addEntity } from "@/features/data/utils/actions"
import { relationKindMeta } from "@/features/data/utils/relation-kinds"
import { describeRelation } from "@/features/data/utils/schema"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

/**
 * The data model without a canvas — what a phone gets.
 *
 * The diagram is the better way to read a schema and the worse way to edit one
 * with a thumb, so below the desktop breakpoint the tables become a list and
 * the relations are spelled out under each one. Same data, same actions, no
 * dragging.
 */
export function EntityList({ project }: { project: Project }) {
  const select = useUiStore((s) => s.select)
  const selectedId = useUiStore((s) => s.selectedId)

  if (!project.entities.length) {
    return (
      <EmptyState
        icon={<Database />}
        title="No tables yet"
        description="The tables every build reads and writes. Add the first one, and the generated prompt carries the schema instead of leaving it to be guessed."
        action={
          <Button
            onClick={() => {
              const id = addEntity("Users")
              if (id) select(id)
            }}
          >
            <Plus /> Add first table
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-2 p-3">
      {project.entities.map((entity) => {
        const relations = project.relations.filter(
          (relation) => relation.from === entity.id || relation.to === entity.id
        )
        const foreignKeys = new Set(
          project.relations
            .filter((relation) => relation.from === entity.id)
            .map((relation) => relation.fromField)
        )
        return (
          <button
            type="button"
            key={entity.id}
            onClick={() => select(entity.id)}
            className={cn(
              "block w-full rounded-xl border bg-card p-2.5 text-left transition-colors",
              selectedId === entity.id
                ? "border-primary ring-2 ring-primary/25"
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{entity.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {entity.key}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {entity.fields.length} columns
              </span>
            </span>
            {entity.note.trim() && (
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {entity.note}
              </span>
            )}
            <span className="mt-1.5 flex flex-wrap gap-1">
              {entity.fields.map((field) => (
                <span
                  key={field.id}
                  className="flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]"
                >
                  {field.primary && <KeyRound className="size-2.5 text-warning" />}
                  {foreignKeys.has(field.name) && (
                    <Link2 className="size-2.5 text-info" />
                  )}
                  {field.name}
                  <span className="text-muted-foreground">{field.type}</span>
                </span>
              ))}
            </span>
            {relations.length > 0 && (
              <span className="mt-1.5 block space-y-0.5">
                {relations.map((relation) => (
                  <span
                    key={relation.id}
                    className="block font-mono text-[10px]"
                    style={{ color: relationKindMeta[relation.kind].color }}
                  >
                    {relationKindMeta[relation.kind].short}{" "}
                    {describeRelation(project, relation)}
                  </span>
                ))}
              </span>
            )}
          </button>
        )
      })}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          const id = addEntity()
          if (id) select(id)
        }}
      >
        <Plus /> Add table
      </Button>
    </div>
  )
}
