"use client"

import { FilePlus2, Workflow } from "lucide-react"
import { useEffect } from "react"
import { Workbench } from "@/components/layout/workbench"
import { EmptyState } from "@/components/shared/feedback"
import { Button } from "@/components/ui/button"
import { AuthGate } from "@/features/auth/components/auth-gate"
import { useActiveProject, useProjectStore } from "@/stores/use-project-store"

function Studio() {
  const hydrated = useProjectStore((s) => s.hydrated)
  const projects = useProjectStore((s) => s.projects)
  const activeId = useProjectStore((s) => s.activeId)
  const project = useActiveProject()

  // First run — or a store whose active project was deleted elsewhere. The
  // dependency is `projects.length`, not `projects`: this only cares whether
  // any exist, and depending on the array would re-run it on every edit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!hydrated) return
    const store = useProjectStore.getState()
    if (!store.projects.length) {
      // Only on a genuine first run. "No projects" alone cannot tell that from
      // someone who has just deleted their last one — and it used to recreate
      // it a second later, which synced up as a new row and made delete look
      // broken when it had worked.
      if (!store.seeded) store.createProject("saas-dashboard", "My first project")
      return
    }
    if (!store.projects.some((p) => p.id === store.activeId)) {
      store.setActive(store.projects[0].id)
    }
  }, [hydrated, projects.length, activeId])

  // Deleting the last project is now allowed to leave the studio empty, so
  // there has to be something here to see. Previously this state was
  // unreachable — the bootstrap above refilled it before anyone could look at
  // it — and the loading screen would have sat there indefinitely.
  if (hydrated && !project && !projects.length) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <EmptyState
          icon={<Workflow />}
          title="No projects"
          description="Every screen, journey and prompt lives inside a project. Start one and the canvas opens on it."
          action={
            <span className="flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() =>
                  useProjectStore.getState().createProject("saas-dashboard", "My first project")
                }
              >
                <FilePlus2 /> Start from a dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => useProjectStore.getState().createProject("blank", "Untitled project")}
              >
                Blank project
              </Button>
            </span>
          }
        />
      </div>
    )
  }

  if (!hydrated || !project) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <span className="flex size-10 animate-pulse items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Workflow className="size-5" />
        </span>
        <p className="text-sm">Loading your projects…</p>
      </div>
    )
  }

  return <Workbench project={project} />
}

export function StudioApp() {
  return (
    <AuthGate>
      <Studio />
    </AuthGate>
  )
}
