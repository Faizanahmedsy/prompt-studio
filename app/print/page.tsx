"use client"

import { FileText, Printer, Type } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { getTarget } from "@/features/prompt/engine/targets"
import { Markdown } from "@/features/prompt/markdown/markdown"
import { formatDate } from "@/lib/utils"
import { useActiveProject, useProjectStore } from "@/stores/use-project-store"
import { usePromptDraftStore } from "@/stores/use-prompt-draft-store"

/** A paper-friendly rendering of the current prompt — for reviews and handovers. */
export default function PrintPage() {
  const hydrated = useProjectStore((s) => s.hydrated)
  const project = useActiveProject()
  // Rendered by default — this page exists to be *read*. The raw view is one
  // click away for anyone who came here to copy the source instead.
  const [rendered, setRendered] = useState(true)

  useEffect(() => {
    useProjectStore.persist.rehydrate()
    usePromptDraftStore.persist.rehydrate()
  }, [])

  // A hand-edited prompt is *the* prompt — printing the build instead would
  // hand a reviewer a document nobody is going to send.
  const drafts = usePromptDraftStore((s) => s.drafts)
  const draft = project ? (drafts[`${project.id}:web`] ?? null) : null

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
        <span className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRendered((on) => !on)}>
            {rendered ? <Type /> : <FileText />}
            {rendered ? "Raw markdown" : "Rendered"}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </span>
      </div>

      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build prompt for {getTarget(project.target).name} ·{" "}
          {project.screens.length} screens · {project.edges.length} connections ·{" "}
          {formatDate(Date.now())}
        </p>
      </header>

      {draft !== null ? (
        <section className="mb-6">
          {rendered ? (
            <Markdown source={draft} />
          ) : (
            <pre className="code-surface whitespace-pre-wrap break-words text-[12px] leading-relaxed">
              {draft}
            </pre>
          )}
        </section>
      ) : (
        built.blocks.map((block) => (
        <section key={block.id} className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {block.title}
          </h2>
          {rendered ? (
            <Markdown source={block.body} />
          ) : (
            <pre className="code-surface whitespace-pre-wrap break-words text-[12px] leading-relaxed">
              {block.body}
            </pre>
          )}
        </section>
        ))
      )}
    </main>
  )
}
