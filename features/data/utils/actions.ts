"use client"

import { autoLayout } from "@/features/builder/utils/graph"
import { ENTITY_WIDTH, entityHeight } from "@/features/data/utils/geometry"
import {
  fieldByName,
  foreignKeyName,
  primaryKeyOf,
} from "@/features/data/utils/schema"
import { slugify, uid, uniqueKey } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import type {
  Entity,
  EntityField,
  ProjectDoc,
  Relation,
  RelationKind,
} from "@/types/project"

const update = (
  mutate: (doc: ProjectDoc) => void,
  options?: { coalesce?: string; silent?: boolean }
) => useProjectStore.getState().update(mutate, options)

function field(patch: Partial<EntityField> = {}): EntityField {
  return {
    id: uid("fld"),
    name: "column",
    type: "text",
    primary: false,
    required: false,
    unique: false,
    indexed: false,
    defaultValue: "",
    options: [],
    note: "",
    ...patch,
  }
}

/**
 * A new table is never empty.
 *
 * Every table in every real schema has a key and a created-at, and starting
 * from a blank card means the first thing anyone does is type the same three
 * columns again — or forget to, and hand the model a table with no key.
 */
export function newEntityFields(): EntityField[] {
  return [
    field({ name: "id", type: "uuid", primary: true, required: true }),
    field({
      name: "created_at",
      type: "timestamp",
      required: true,
      defaultValue: "now()",
    }),
  ]
}

export function addEntity(name = "New table") {
  let created: string | null = null
  update((doc) => {
    const key = uniqueKey(
      slugify(name).replace(/-/g, "_") || "table",
      doc.entities.map((entity) => entity.key)
    )
    const entity: Entity = {
      id: uid("ent"),
      key,
      name,
      note: "",
      fields: newEntityFields(),
      // Dropped to the right of everything else rather than on top of the
      // table in the middle of the canvas.
      x: doc.entities.length
        ? Math.max(...doc.entities.map((e) => e.x)) + ENTITY_WIDTH + 90
        : 0,
      y: 0,
    }
    doc.entities.push(entity)
    created = entity.id
  })
  return created
}

export function updateEntity(id: string, patch: Partial<Entity>) {
  update((doc) => {
    const entity = doc.entities.find((e) => e.id === id)
    if (!entity) return
    if (patch.key !== undefined) {
      const key = slugify(patch.key).replace(/-/g, "_")
      entity.key = key
        ? uniqueKey(
            key,
            doc.entities.filter((e) => e.id !== id).map((e) => e.key)
          )
        : entity.key
    }
    if (patch.name !== undefined) entity.name = patch.name
    if (patch.note !== undefined) entity.note = patch.note
  })
}

export function deleteEntity(id: string) {
  update((doc) => {
    doc.entities = doc.entities.filter((entity) => entity.id !== id)
    // A relation with one end missing is not a relation; it would render as an
    // arrow from nowhere and generate a migration that cannot run.
    doc.relations = doc.relations.filter(
      (relation) => relation.from !== id && relation.to !== id
    )
  })
}

export function moveEntity(id: string, x: number, y: number) {
  update(
    (doc) => {
      const entity = doc.entities.find((e) => e.id === id)
      if (!entity) return
      entity.x = Math.round(x)
      entity.y = Math.round(y)
    },
    // One undo step per drag, not one per mouse move.
    { coalesce: `move-entity:${id}` }
  )
}

export function addField(entityId: string, patch: Partial<EntityField> = {}) {
  let created: string | null = null
  update((doc) => {
    const entity = doc.entities.find((e) => e.id === entityId)
    if (!entity) return
    const base = patch.name ?? "column"
    const next = field({
      ...patch,
      name: uniqueKey(
        slugify(base).replace(/-/g, "_") || "column",
        entity.fields.map((f) => f.name)
      ),
    })
    entity.fields.push(next)
    created = next.id
  })
  return created
}

export function updateField(
  entityId: string,
  fieldId: string,
  patch: Partial<EntityField>
) {
  update((doc) => {
    const entity = doc.entities.find((e) => e.id === entityId)
    const target = entity?.fields.find((f) => f.id === fieldId)
    if (!entity || !target) return

    const before = target.name
    Object.assign(target, patch)

    if (patch.name !== undefined) {
      const cleaned = slugify(patch.name).replace(/-/g, "_")
      target.name = cleaned
        ? uniqueKey(
            cleaned,
            entity.fields.filter((f) => f.id !== fieldId).map((f) => f.name)
          )
        : before
      // Relations name their columns by string, so a rename has to carry, or
      // the relation quietly starts pointing at a column that is not there.
      for (const relation of doc.relations) {
        if (relation.from === entityId && relation.fromField === before) {
          relation.fromField = target.name
        }
        if (relation.to === entityId && relation.toField === before) {
          relation.toField = target.name
        }
      }
    }

    // Only one primary key at a time unless somebody deliberately adds another
    // from the inspector — marking a second silently would break the migration.
    if (patch.primary) {
      target.required = true
    }
  })
}

export function deleteField(entityId: string, fieldId: string) {
  update((doc) => {
    const entity = doc.entities.find((e) => e.id === entityId)
    if (!entity) return
    const gone = entity.fields.find((f) => f.id === fieldId)
    entity.fields = entity.fields.filter((f) => f.id !== fieldId)
    if (!gone) return
    doc.relations = doc.relations.filter(
      (relation) =>
        !(relation.from === entityId && relation.fromField === gone.name) &&
        !(relation.to === entityId && relation.toField === gone.name)
    )
  })
}

export function moveField(entityId: string, fieldId: string, toIndex: number) {
  update((doc) => {
    const entity = doc.entities.find((e) => e.id === entityId)
    if (!entity) return
    const index = entity.fields.findIndex((f) => f.id === fieldId)
    if (index === -1) return
    const [moved] = entity.fields.splice(index, 1)
    entity.fields.splice(Math.max(0, Math.min(toIndex, entity.fields.length)), 0, moved)
  })
}

/**
 * Join two tables.
 *
 * The foreign key is created as part of the relation rather than left to be
 * added by hand: a relation with no column behind it is a picture of a schema,
 * not a schema, and that is exactly the gap that used to be filled by the model
 * guessing.
 */
export function connectEntities(
  fromId: string,
  toId: string,
  kind: RelationKind = "many-to-one"
) {
  let created: string | null = null
  update((doc) => {
    const from = doc.entities.find((e) => e.id === fromId)
    const to = doc.entities.find((e) => e.id === toId)
    if (!from || !to) return

    const already = doc.relations.find(
      (relation) => relation.from === fromId && relation.to === toId
    )
    if (already) {
      created = already.id
      return
    }

    const targetKey = primaryKeyOf(to)
    const relation: Relation = {
      id: uid("rel"),
      from: fromId,
      to: toId,
      fromField: "",
      toField: targetKey?.name ?? "id",
      kind,
      label: "",
      onDelete: "restrict",
      through: "",
    }

    if (kind === "many-to-many") {
      relation.through = ""
    } else {
      const name = foreignKeyName(to)
      const existing = fieldByName(from, name)
      if (existing) {
        relation.fromField = existing.name
      } else {
        const fk = field({
          name: uniqueKey(
            name,
            from.fields.map((f) => f.name)
          ),
          type: targetKey?.type ?? "uuid",
          required: kind !== "one-to-one",
          unique: kind === "one-to-one",
          indexed: true,
        })
        from.fields.push(fk)
        relation.fromField = fk.name
      }
    }

    doc.relations.push(relation)
    created = relation.id
  })
  return created
}

/**
 * Join one column to another — what dragging from a column handle to another
 * column does. The columns already exist, so nothing is created: this is the
 * precise form of `connectEntities`, which has to invent the foreign key.
 */
export function connectEntityFields(
  fromId: string,
  fromFieldId: string,
  toId: string,
  toFieldId: string
) {
  let created: string | null = null
  update((doc) => {
    const from = doc.entities.find((e) => e.id === fromId)
    const to = doc.entities.find((e) => e.id === toId)
    const fromColumn = from?.fields.find((f) => f.id === fromFieldId)
    const toColumn = to?.fields.find((f) => f.id === toFieldId)
    if (!from || !to || !fromColumn || !toColumn) return

    const already = doc.relations.find(
      (relation) =>
        relation.from === fromId &&
        relation.to === toId &&
        relation.fromField === fromColumn.name
    )
    if (already) {
      created = already.id
      return
    }

    const relation: Relation = {
      id: uid("rel"),
      from: fromId,
      to: toId,
      fromField: fromColumn.name,
      toField: toColumn.name,
      // A unique column on this side can only hold one match, which is the
      // definition of one-to-one — read rather than asked for.
      kind: fromColumn.unique ? "one-to-one" : "many-to-one",
      label: "",
      onDelete: "restrict",
      through: "",
    }
    if (!fromColumn.indexed) fromColumn.indexed = true
    doc.relations.push(relation)
    created = relation.id
  })
  return created
}

export function updateRelation(id: string, patch: Partial<Relation>) {
  update((doc) => {
    const relation = doc.relations.find((r) => r.id === id)
    if (!relation) return
    Object.assign(relation, patch)
  })
}

export function deleteRelation(id: string) {
  update((doc) => {
    doc.relations = doc.relations.filter((relation) => relation.id !== id)
  })
}

/** Lay the tables out by what points at what — the same engine the flow canvas uses. */
export function arrangeEntities(options?: { silent?: boolean }) {
  update(
    (doc) => {
      const heights: Record<string, number> = {}
      for (const entity of doc.entities) {
        heights[entity.id] = entityHeight(entity.fields.length)
      }
      doc.entities = autoLayout(
        doc.entities,
        doc.relations.map((relation) => ({
          id: relation.id,
          from: relation.from,
          to: relation.to,
        })),
        { heights, nodeWidth: ENTITY_WIDTH, colGap: 110, rowGap: 44 }
      )
    },
    options?.silent ? { silent: true } : undefined
  )
}
