"use client"

import { ArrowRight, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { SelectField, TextAreaField, TextField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/misc"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fieldTypes } from "@/features/data/data/field-types"
import {
  addField,
  connectEntities,
  deleteEntity,
  deleteField,
  deleteRelation,
  updateEntity,
  updateField,
  updateRelation,
} from "@/features/data/utils/actions"
import {
  relationKindMeta,
  relationKinds,
} from "@/features/data/utils/relation-kinds"
import { describeRelation } from "@/features/data/utils/schema"
import { useUiStore } from "@/stores/use-ui-store"
import type { Entity, EntityField, Project, RelationKind } from "@/types/project"

const typeOptions = fieldTypes.map((type) => ({
  value: type.id,
  label: `${type.label} — ${type.hint}`,
}))

/**
 * Everything about one table. The columns are edited in place rather than
 * through a dialog per column, because a table is read as a list and a schema
 * is written by going down that list once.
 */
export function EntityInspector({
  project,
  entity,
}: {
  project: Project
  entity: Entity
}) {
  const selectedId = useUiStore((s) => s.selectedId)
  const select = useUiStore((s) => s.select)
  const [openField, setOpenField] = useState<string | null>(selectedId)
  const [target, setTarget] = useState("")

  const relations = project.relations.filter(
    (relation) => relation.from === entity.id || relation.to === entity.id
  )
  const others = project.entities.filter((other) => other.id !== entity.id)

  return (
    <div className="space-y-4">
      <TextField
        label="Table"
        value={entity.name}
        onChange={(event) => updateEntity(entity.id, { name: event.target.value })}
        placeholder="Orders"
      />
      <TextField
        label="Table name in the database"
        value={entity.key}
        onChange={(event) => updateEntity(entity.id, { key: event.target.value })}
        hint="snake_case. Renaming it here renames it everywhere the prompt mentions it."
      />
      <TextAreaField
        label="What it holds"
        value={entity.note}
        rows={2}
        onChange={(event) => updateEntity(entity.id, { note: event.target.value })}
        placeholder="One row per order placed by a customer."
      />

      <div className="space-y-1.5">
        <SectionLabel>Columns</SectionLabel>
        <ul className="space-y-1">
          {entity.fields.map((field) => (
            <FieldRow
              key={field.id}
              entity={entity}
              field={field}
              open={openField === field.id}
              onToggle={() => {
                const next = openField === field.id ? null : field.id
                setOpenField(next)
                select(next ?? entity.id)
              }}
            />
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            const id = addField(entity.id)
            if (id) setOpenField(id)
          }}
        >
          <Plus /> Add column
        </Button>
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Relations</SectionLabel>
        {relations.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Nothing joins this table yet — drag from a column to another table's
            column on the canvas, or pick one below.
          </p>
        )}
        <ul className="space-y-2">
          {relations.map((relation) => {
            const outgoing = relation.from === entity.id
            return (
              <li
                key={relation.id}
                className="space-y-1.5 rounded-lg border border-border bg-surface p-2"
              >
                <div className="flex items-center gap-1.5">
                  <ArrowRight
                    className="size-3.5 shrink-0"
                    style={{ color: relationKindMeta[relation.kind].color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                    {describeRelation(project, relation)}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => deleteRelation(relation.id)}
                    aria-label="Delete relation"
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    value={relation.kind}
                    onValueChange={(value) =>
                      updateRelation(relation.id, { kind: value as RelationKind })
                    }
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {relationKinds.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {relationKindMeta[kind].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={relation.onDelete}
                    onValueChange={(value) =>
                      updateRelation(relation.id, {
                        onDelete: value as "cascade" | "restrict" | "set-null",
                      })
                    }
                    disabled={!outgoing}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restrict">On delete: block</SelectItem>
                      <SelectItem value="cascade">On delete: cascade</SelectItem>
                      <SelectItem value="set-null">On delete: null it</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {relation.kind === "many-to-many" && (
                  <Input
                    value={relation.through}
                    onChange={(event) =>
                      updateRelation(relation.id, { through: event.target.value })
                    }
                    placeholder="Join table name, e.g. order_tags"
                    className="h-7 text-[11px]"
                  />
                )}
                <Input
                  value={relation.label}
                  onChange={(event) =>
                    updateRelation(relation.id, { label: event.target.value })
                  }
                  placeholder="In words — an order belongs to one customer"
                  className="h-7 text-[11px]"
                />
              </li>
            )
          })}
        </ul>

        {others.length > 0 && (
          <div className="flex gap-1.5">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Points at…" />
              </SelectTrigger>
              <SelectContent>
                {others.map((other) => (
                  <SelectItem key={other.id} value={other.id}>
                    {other.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={!target}
              onClick={() => {
                if (!target) return
                connectEntities(entity.id, target)
                setTarget("")
              }}
              aria-label="Add relation"
              title="Adds the foreign key column too"
            >
              <Plus />
            </Button>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive hover:bg-destructive-soft"
        onClick={() => {
          deleteEntity(entity.id)
          select(null)
        }}
      >
        <Trash2 /> Delete table
      </Button>
    </div>
  )
}

function FieldRow({
  entity,
  field,
  open,
  onToggle,
}: {
  entity: Entity
  field: EntityField
  open: boolean
  onToggle: () => void
}) {
  return (
    <li className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-1 p-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {open ? (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
            {field.name}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {field.type}
          </span>
        </button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => deleteField(entity.id, field.id)}
          aria-label={`Delete ${field.name}`}
        >
          <Trash2 />
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border p-2">
          <Input
            value={field.name}
            onChange={(event) =>
              updateField(entity.id, field.id, { name: event.target.value })
            }
            placeholder="column_name"
            className="h-7 font-mono text-[11px]"
          />
          <SelectField
            value={field.type}
            onValueChange={(value) =>
              updateField(entity.id, field.id, { type: value })
            }
            options={typeOptions}
          />
          {field.type === "enum" && (
            <Input
              value={field.options.join(", ")}
              onChange={(event) =>
                updateField(entity.id, field.id, {
                  options: event.target.value
                    .split(",")
                    .map((option) => option.trim())
                    .filter(Boolean),
                })
              }
              placeholder="draft, sent, paid"
              className="h-7 text-[11px]"
            />
          )}
          <Input
            value={field.defaultValue}
            onChange={(event) =>
              updateField(entity.id, field.id, { defaultValue: event.target.value })
            }
            placeholder="Default — now(), 0, 'draft'"
            className="h-7 font-mono text-[11px]"
          />
          <div className="grid grid-cols-2 gap-1">
            <Flag
              label="Primary key"
              checked={field.primary}
              onChange={(checked) =>
                updateField(entity.id, field.id, { primary: checked })
              }
            />
            <Flag
              label="Required"
              checked={field.required}
              onChange={(checked) =>
                updateField(entity.id, field.id, { required: checked })
              }
            />
            <Flag
              label="Unique"
              checked={field.unique}
              onChange={(checked) =>
                updateField(entity.id, field.id, { unique: checked })
              }
            />
            <Flag
              label="Indexed"
              checked={field.indexed}
              onChange={(checked) =>
                updateField(entity.id, field.id, { indexed: checked })
              }
            />
          </div>
          <Input
            value={field.note}
            onChange={(event) =>
              updateField(entity.id, field.id, { note: event.target.value })
            }
            placeholder="What it holds, if it is not obvious"
            className="h-7 text-[11px]"
          />
        </div>
      )}
    </li>
  )
}

function Flag({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer select-none items-center gap-1.5 rounded px-1 py-1 text-[11px] transition-colors hover:bg-muted/60"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
      />
      {label}
    </label>
  )
}
