/**
 * One list of versions, from two places.
 *
 * The history the dialog showed was `project.versions` — localStorage, per
 * browser, invisible to everyone else on the project, and gone with the site
 * data. Meanwhile the server had been keeping fifty of them per project that
 * nothing in the app ever read.
 *
 * So a linked project shows the server's history, which is the shared one, and
 * an unlinked or signed-out project shows the local one, which is all it has.
 * Both are rendered from the same row shape, because a person looking at their
 * history should not have to know which of those two situations they are in.
 */

import type { ActivityRead, VersionSummary } from "@/lib/api/types"
import type { Snapshot } from "@/types/project"

export type VersionRow = {
  id: string
  label: string
  /** display name, or the address when there is no name, or "" for neither */
  by: string
  createdAt: number
  kind: Snapshot["kind"]
  /** where the row came from, and therefore what can be done with it */
  source: "server" | "local"
  /** the server's document counter, for a row that has one */
  docVersion?: number
}

/** The local snapshot shape, unchanged — it already carries everything. */
export function localRow(snapshot: Snapshot): VersionRow {
  return {
    id: snapshot.id,
    label: snapshot.label,
    by: snapshot.by,
    createdAt: snapshot.createdAt,
    kind: snapshot.kind,
    source: "local",
  }
}

/**
 * A server version as a row.
 *
 * `is_auto` is the server's word for "taken by a timer and prunable", which is
 * exactly what `auto` means locally. Anything labelled was asked for by a
 * person, so it is `manual` — the server has no notion of a snapshot taken
 * because a prompt was generated, and inventing one from the label text would
 * be guessing.
 */
export function serverRow(version: VersionSummary): VersionRow {
  return {
    id: version.id,
    label: version.label || "Autosave",
    by: version.created_by_name || version.created_by_email || "",
    createdAt: Date.parse(version.created_at) || 0,
    kind: version.is_auto ? "auto" : "manual",
    source: "server",
    docVersion: version.doc_version,
  }
}

/** Newest first, which is the only order a history is ever read in. */
export function sortRows(rows: VersionRow[]): VersionRow[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export type EditEntry = {
  id: string
  by: string
  at: number
  /** how many saves the entry covers — the server collapses a run into one */
  edits: number
}

/**
 * The "who changed what" feed, reduced to the entries that answer it.
 *
 * Everything else in the activity stream — renames, invitations, link changes —
 * is already visible where it happened. What was missing is the editing
 * itself, and that is what this pulls out.
 */
export function editEntries(activity: ActivityRead[]): EditEntry[] {
  return activity
    .filter((row) => row.type === "PROJECT_UPDATED")
    .map((row) => ({
      id: row.id,
      by: row.actor_email || "Someone",
      at: Date.parse(row.created_at) || 0,
      edits: Number(row.meta?.edits ?? 1),
    }))
    .sort((a, b) => b.at - a.at)
}
