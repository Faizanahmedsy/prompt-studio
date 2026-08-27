"use client"

import { Link2Off, Workflow } from "lucide-react"
import Link from "next/link"
import { use, useEffect, useState } from "react"

import { Workbench } from "@/components/layout/workbench"
import { EmptyState } from "@/components/shared/feedback"
import { Button } from "@/components/ui/button"
import {
  setPublicViewer,
  TRANSIENT_PREFIX,
} from "@/features/cloud/read-only"
import { isApiError } from "@/lib/api/client"
import * as projectsApi from "@/lib/api/projects"
import { uid } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { type Project, projectDocSchema, SCHEMA_VERSION } from "@/types/project"

/**
 * A shared project, to anyone holding the link.
 *
 * Deliberately outside `AuthGate`: needing an account is the one thing this
 * page exists to avoid. It is also read-only by construction rather than by
 * hiding buttons — `setPublicViewer(true)` locks the project store itself, so
 * every edit path in the editor, including the keyboard shortcuts and the
 * canvas drag handlers, is refused at the source.
 *
 * The document is loaded into a *transient* project (see `TRANSIENT_PREFIX`).
 * A visitor who is signed in has projects of their own, and this one must not
 * be persisted into their list or uploaded to their account.
 */

type State =
  | { kind: "loading" }
  | { kind: "ready"; localId: string }
  | { kind: "gone" }
  | { kind: "error"; message: string }

export default function PublicProjectPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [state, setState] = useState<State>({ kind: "loading" })
  const project = useProjectStore((s) =>
    state.kind === "ready" ? (s.projects.find((p) => p.id === state.localId) ?? null) : null
  )

  useEffect(() => {
    // Set before the document is inserted, so there is no window in which the
    // project is on screen and still writable.
    setPublicViewer(true)
    let cancelled = false
    let createdId: string | null = null

    projectsApi
      .getPublicProject(token)
      .then((shared) => {
        if (cancelled) return
        const parsed = projectDocSchema.safeParse(shared.doc)
        if (!parsed.success) {
          setState({
            kind: "error",
            message: "This project was made with a different version of Prompt Studio.",
          })
          return
        }
        const now = Date.now()
        const local: Project = {
          ...parsed.data,
          id: uid(TRANSIENT_PREFIX.replace(/_$/, "")),
          name: shared.name || parsed.data.name,
          createdAt: now,
          updatedAt: now,
          schemaVersion: SCHEMA_VERSION,
          versions: [],
        }
        createdId = local.id
        // Straight into the store rather than through `importProject`, which
        // would re-id it and lose the transient prefix that keeps it out of
        // localStorage and out of the viewer's account.
        useProjectStore.setState((store) => ({
          projects: [...store.projects, local],
          activeId: local.id,
        }))
        setState({ kind: "ready", localId: local.id })
      })
      .catch((failure) => {
        if (cancelled) return
        if (isApiError(failure) && failure.status === 404) {
          setState({ kind: "gone" })
          return
        }
        setState({
          kind: "error",
          message: isApiError(failure) ? failure.message : "Check your connection and try again.",
        })
      })

    return () => {
      cancelled = true
      setPublicViewer(false)
      // Take the transient project back out, and put the viewer back on
      // whatever of their own they had open.
      if (createdId) {
        useProjectStore.setState((store) => ({
          projects: store.projects.filter((p) => p.id !== createdId),
          activeId:
            store.activeId === createdId
              ? (store.projects.find((p) => p.id !== createdId)?.id ?? null)
              : store.activeId,
        }))
      }
    }
  }, [token])

  if (state.kind === "gone") {
    return (
      <Shell>
        <EmptyState
          icon={<Link2Off />}
          title="This link is no longer available"
          description="It may have been turned off by its owner, replaced with a new link, or the project may have been deleted."
          action={
            <Button asChild variant="outline">
              <Link href="/">Go to Prompt Studio</Link>
            </Button>
          }
        />
      </Shell>
    )
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <EmptyState
          icon={<Link2Off />}
          title="Could not open this project"
          description={state.message}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          }
        />
      </Shell>
    )
  }

  if (state.kind === "loading" || !project) {
    return (
      <Shell>
        <span className="flex size-10 animate-pulse items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Workflow className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">Opening the shared project…</p>
      </Shell>
    )
  }

  return <Workbench project={project} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6">{children}</div>
  )
}
