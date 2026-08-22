"use client"

import { Workflow } from "lucide-react"
import { useEffect } from "react"

import { Workbench } from "@/components/layout/workbench"
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
      store.createProject("saas-dashboard", "My first project")
      return
    }
    if (!store.projects.some((p) => p.id === store.activeId)) {
      store.setActive(store.projects[0].id)
    }
  }, [hydrated, projects.length, activeId])

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

export default function StudioPage() {
  return (
    <AuthGate>
      <Studio />
    </AuthGate>
  )
}
