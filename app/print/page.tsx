"use client"

import { Printer } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { getTarget } from "@/features/prompt/engine/targets"
import { formatDate } from "@/lib/utils"
import { useActiveProject, useProjectStore } from "@/stores/use-project-store"

/** A paper-friendly rendering of the current prompt — for reviews and handovers. */
export default function PrintPage() {
  const hydrated = useProjectStore((s) => s.hydrated)
  const project = useActiveProject()

  useEffect(() => {
    useProjectStore.persist.rehydrate()
  }, [])

  const built = useMemo(() => (project ? buildPrompt(project) : null), [project])

  if (!hydrated || !project || !built) {
    return (
      <main className="p-10 text-sm text-muted-foreground">Loading prompt…</main>
    )
  }

  return (
    <main className="print-page mx-auto max-w-3xl px-6 py-8">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Back to the studio</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </div>

      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build prompt for {getTarget(project.target).name} ·{" "}
          {project.screens.length} screens · {project.edges.length} connections ·{" "}
          {formatDate(Date.now())}
        </p>
      </header>

      {built.blocks.map((block) => (
        <section key={block.id} className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {block.title}
          </h2>
          <pre className="code-surface whitespace-pre-wrap break-words text-[12px] leading-relaxed">
            {block.body}
          </pre>
        </section>
      ))}
    </main>
  )
}
