"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { isApiError } from "@/lib/api/client"
import type {
  AnswerCreate,
  ArtifactSummary,
  DiscoveryItem,
  DiscoveryRun,
  ItemAnswer,
} from "@/lib/api/discovery"
import * as discoveryApi from "@/lib/api/discovery"

/**
 * One discovery run, loaded and answered.
 *
 * Deliberately `useState` in a hook rather than a store: this is one screen's
 * worth of server state with a single owner, it is not persisted, and it must
 * not survive switching project — a store would have to be cleared on every
 * change of `remoteId`, which is the bug the hook cannot have.
 *
 * Answers are written optimistically. A decision is a click that has to feel
 * like a click at 178 of them; the row goes green immediately and rolls back
 * with a toast if the server disagrees.
 */
export type Discovery = ReturnType<typeof useDiscovery>

function message(failure: unknown, fallback: string): string {
  return isApiError(failure) ? failure.message : fallback
}

/** What the row shows while the POST is in flight. Replaced by the server's
 *  row on success — the id is the giveaway that this one is not real yet. */
function pendingAnswer(body: AnswerCreate): ItemAnswer {
  return {
    id: "pending",
    decision: body.decision,
    choice_key: body.choice_key ?? null,
    note: body.note ?? null,
    created_at: new Date().toISOString(),
  }
}

export function useDiscovery(remoteId: string | null) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<DiscoveryRun | null>(null)
  const [items, setItems] = useState<DiscoveryItem[]>([])
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([])
  /** artifact name -> body, filled on first open and kept for the session. */
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [reloadKey, setReloadKey] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` is not read in the body — it exists to re-run this effect, which is what the reload button is
  useEffect(() => {
    if (!remoteId) {
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const runs = await discoveryApi.listRuns(remoteId)
        // Newest first, and only the newest is answerable — an older run's
        // questions were written against a KB that has since moved.
        const newest = runs[0] ?? null
        if (!live) return
        setRun(newest)
        if (!newest) {
          setItems([])
          setArtifacts([])
          return
        }
        const [rows, files] = await Promise.all([
          discoveryApi.listItems(remoteId, newest.id),
          discoveryApi.listArtifacts(remoteId),
        ])
        if (!live) return
        setItems(rows)
        setArtifacts(files)
      } catch (failure) {
        if (live) setError(message(failure, "Could not load this project's discovery run"))
      } finally {
        if (live) setLoading(false)
      }
    })()

    return () => {
      live = false
    }
  }, [remoteId, reloadKey])

  const patch = useCallback((id: string, answer: ItemAnswer | null) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, answer } : item))
    )
  }, [])

  const answer = useCallback(
    async (item: DiscoveryItem, body: AnswerCreate) => {
      if (!remoteId || !run) return
      const before = item.answer
      patch(item.id, pendingAnswer(body))
      try {
        const saved = await discoveryApi.answerItem(remoteId, run.id, item.id, body)
        patch(item.id, saved)
      } catch (failure) {
        patch(item.id, before)
        toast.error(message(failure, "That answer did not save"))
      }
    },
    [remoteId, run, patch]
  )

  const acceptDefaults = useCallback(
    async (batch: DiscoveryItem[]) => {
      if (!remoteId || !run) return
      const acceptable = batch.filter((item) => !item.answer && item.proposed !== null)
      if (!acceptable.length) return
      const ids = new Set(acceptable.map((item) => item.id))

      setItems((current) =>
        current.map((item) =>
          ids.has(item.id)
            ? {
                ...item,
                answer: pendingAnswer({
                  decision: item.proposed ?? "",
                  choice_key: item.proposed_key ?? undefined,
                }),
              }
            : item
        )
      )

      try {
        const result = await discoveryApi.acceptDefaults(remoteId, run.id, [...ids])
        // The server skips anything already answered — by another tab, or by
        // the agent between the load and the click. Those roll back on their
        // own so the row stops claiming an answer this browser invented.
        if (result.skipped.length) {
          const skipped = new Set(result.skipped)
          setItems((current) =>
            current.map((item) => (skipped.has(item.id) ? { ...item, answer: null } : item))
          )
        }
        toast.success(
          `${result.accepted} default${result.accepted === 1 ? "" : "s"} accepted`
        )
      } catch (failure) {
        setItems((current) =>
          current.map((item) => (ids.has(item.id) ? { ...item, answer: null } : item))
        )
        toast.error(message(failure, "Those defaults did not save"))
      }
    },
    [remoteId, run]
  )

  /** Bodies are fetched one at a time, on first open of the tab that shows
   *  them: the list route deliberately omits them, and a run can carry a
   *  megabyte of KB nobody has asked to read. */
  const openArtifact = useCallback(
    async (name: string) => {
      if (!remoteId || bodies[name] !== undefined) return
      try {
        const file = await discoveryApi.getArtifact(remoteId, name)
        setBodies((current) => ({ ...current, [name]: file.body }))
      } catch (failure) {
        toast.error(message(failure, `Could not open ${name}`))
      }
    },
    [remoteId, bodies]
  )

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { loading, error, run, items, artifacts, bodies, answer, acceptDefaults, openArtifact, reload }
}
