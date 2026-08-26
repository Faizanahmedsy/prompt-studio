"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { Hash, KeyRound, Link2, Plus, Table2 } from "lucide-react"
import { memo } from "react"
import { fieldTypeMap } from "@/features/data/data/field-types"
import { addField } from "@/features/data/utils/actions"
import {
  ENTITY_FOOTER,
  ENTITY_HEADER,
  ENTITY_ROW,
} from "@/features/data/utils/geometry"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Entity } from "@/types/project"

export type EntityNodeData = {
  entity: Entity
  /** column names on this table that a relation uses */
  foreignKeys: Set<string>
  /** how many relations touch this table */
  relationCount: number
}

/**
 * A table on the data canvas: the columns, in order, with the facts that change
 * what gets generated — key, foreign key, required, unique.
 *
 * Every column carries its own ports, so a relation is drawn between the two
 * columns it actually joins rather than between two cards, which is the
 * difference between a picture of a schema and a schema.
 */
export const EntityNode = memo(function EntityNode({
  data,
  selected,
}: NodeProps & { data: EntityNodeData }) {
  const { entity, foreignKeys } = data
  const select = useUiStore((s) => s.select)
  const selectedId = useUiStore((s) => s.selectedId)

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
        selected
          ? "border-primary shadow-md ring-2 ring-primary/25"
          : "border-border hover:shadow-md"
      )}
    >
      <div
        className="flex items-center gap-2 border-b border-border bg-surface px-2.5"
        style={{ height: ENTITY_HEADER }}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Table2 className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold leading-tight">
            {entity.name}
          </span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {entity.key}
          </span>
        </span>
      </div>

      <ul>
        {entity.fields.map((field) => {
          const type = fieldTypeMap.get(field.type)
          const isForeign = foreignKeys.has(field.name)
          return (
            <li
              key={field.id}
              className={cn(
                "relative flex items-center gap-1.5 border-b border-border/60 px-2.5 text-[11px] last:border-b-0",
                selectedId === field.id && "bg-primary-soft"
              )}
              style={{ height: ENTITY_ROW }}
            >
              {/* Both directions on both sides: a relation may be drawn from
                  either end, and hunting for the one port that accepts a drag
                  is not a thing anyone should have to do. */}
              <Handle
                id={field.id}
                type="target"
                position={Position.Left}
                className="!size-2 !border !border-card !bg-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100"
              />
              <span className="flex w-3.5 shrink-0 justify-center text-muted-foreground">
                {field.primary ? (
                  <KeyRound className="size-3 text-warning" />
                ) : isForeign ? (
                  <Link2 className="size-3 text-info" />
                ) : field.indexed ? (
                  <Hash className="size-2.5 opacity-60" />
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => select(field.id)}
                className="min-w-0 flex-1 truncate text-left font-mono hover:text-primary"
                title={field.note || `${field.name} · ${type?.label ?? field.type}`}
              >
                {field.name}
                {field.required && !field.primary && (
                  <span className="text-destructive"> *</span>
                )}
              </button>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {field.type}
                {field.unique && !field.primary ? " ·u" : ""}
              </span>
              <Handle
                id={field.id}
                type="source"
                position={Position.Right}
                className="!size-2 !border !border-card !bg-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100"
              />
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          const id = addField(entity.id)
          if (id) select(id)
        }}
        className="flex w-full items-center justify-center gap-1 border-t border-border text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        style={{ height: ENTITY_FOOTER }}
      >
        <Plus className="size-3" /> Add column
      </button>
    </div>
  )
})
