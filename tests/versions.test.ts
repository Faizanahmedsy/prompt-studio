import { describe, expect, it } from "vitest"

import { editEntries, localRow, serverRow, sortRows } from "@/features/projects/versions"
import type { ActivityRead, VersionSummary } from "@/lib/api/types"
import type { Snapshot } from "@/types/project"

/**
 * The history is two sources rendered as one list, and the mapping is where
 * that goes wrong — a row with no author, or a date that parses to NaN and
 * sorts to the end, looks like a bug in the history rather than in a mapper.
 */
const version = (over: Partial<VersionSummary> = {}): VersionSummary => ({
  id: "ver_1",
  label: "Before the rewrite",
  doc_version: 12,
  is_auto: false,
  created_at: "2026-09-02T10:00:00Z",
  created_by: "usr_1",
  created_by_name: "Alice Nowak",
  created_by_email: "alice@example.com",
  ...over,
})

describe("server versions become rows", () => {
  it("names the person, not the id", () => {
    expect(serverRow(version()).by).toBe("Alice Nowak")
  })

  it("falls back to the address when there is no name", () => {
    expect(serverRow(version({ created_by_name: "" })).by).toBe("alice@example.com")
  })

  it("says nothing rather than guessing when there is neither", () => {
    expect(serverRow(version({ created_by_name: "", created_by_email: "" })).by).toBe("")
  })

  it("gives an unlabelled autosnapshot a name a person can read", () => {
    const row = serverRow(version({ label: "", is_auto: true }))
    expect(row.label).toBe("Autosave")
    expect(row.kind).toBe("auto")
  })

  it("carries the document counter, which is what tells two snapshots apart", () => {
    expect(serverRow(version()).docVersion).toBe(12)
  })

  it("parses the timestamp rather than passing a string through", () => {
    expect(serverRow(version()).createdAt).toBe(Date.parse("2026-09-02T10:00:00Z"))
    // An unparseable date must not sort to the top by becoming NaN.
    expect(serverRow(version({ created_at: "not a date" })).createdAt).toBe(0)
  })
})

describe("the two sources sort together", () => {
  it("puts the newest first regardless of where it came from", () => {
    const snapshot: Snapshot = {
      id: "loc_1",
      label: "Saved by hand",
      createdAt: Date.parse("2026-09-02T12:00:00Z"),
      by: "Me",
      kind: "manual",
      doc: {} as Snapshot["doc"],
    }
    const rows = sortRows([serverRow(version()), localRow(snapshot)])
    expect(rows[0].id).toBe("loc_1")
    expect(rows[0].source).toBe("local")
    expect(rows[1].source).toBe("server")
  })
})

describe("the edit feed answers who changed what", () => {
  const activity = (over: Partial<ActivityRead>): ActivityRead => ({
    id: "act_1",
    type: "PROJECT_UPDATED",
    summary: "saved 4 changes",
    actor_id: "usr_1",
    actor_email: "alice@example.com",
    meta: { edits: 4 },
    created_at: "2026-09-02T10:00:00Z",
    ...over,
  })

  it("keeps the edits and drops everything already visible elsewhere", () => {
    const entries = editEntries([
      activity({}),
      activity({ id: "act_2", type: "MEMBER_INVITED", summary: "added bob" }),
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].by).toBe("alice@example.com")
    expect(entries[0].edits).toBe(4)
  })

  it("counts a single save when the server recorded no run", () => {
    expect(editEntries([activity({ meta: null })])[0].edits).toBe(1)
  })
})
