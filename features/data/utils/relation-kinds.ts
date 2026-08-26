import type { RelationKind } from "@/types/project"

export type RelationKindMeta = {
  label: string
  /** the short form drawn on the edge — `N:1` */
  short: string
  hint: string
  color: string
  dashed: boolean
}

/**
 * One colour per kind of relation, the same idea as the flow canvas: a diagram
 * where every line looks the same makes you click each one to find out whether
 * it owns, belongs to, or joins.
 */
export const relationKindMeta: Record<RelationKind, RelationKindMeta> = {
  "many-to-one": {
    label: "Many to one",
    short: "N:1",
    hint: "Many rows here point at one row there — the foreign key lives on this table",
    color: "var(--er-one-many)",
    dashed: false,
  },
  "one-to-many": {
    label: "One to many",
    short: "1:N",
    hint: "One row here owns many rows there — the foreign key lives on the other table",
    color: "var(--er-one-many)",
    dashed: false,
  },
  "one-to-one": {
    label: "One to one",
    short: "1:1",
    hint: "Exactly one row each way — the foreign key is unique",
    color: "var(--er-one-one)",
    dashed: false,
  },
  "many-to-many": {
    label: "Many to many",
    short: "N:N",
    hint: "Many on both sides — needs a join table",
    color: "var(--er-many-many)",
    dashed: true,
  },
}

export const relationKinds: RelationKind[] = [
  "many-to-one",
  "one-to-many",
  "one-to-one",
  "many-to-many",
]

export function relationKindOf(value: unknown): RelationKind {
  return typeof value === "string" && value in relationKindMeta
    ? (value as RelationKind)
    : "many-to-one"
}
