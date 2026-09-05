"use client"

import { Compass, Database, FileText, Loader2, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

import { EmptyState } from "@/components/shared/feedback"
import { PanelBody, PanelHeader, SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuestionCard } from "@/features/discovery/components/question-card"
import {
  byKey,
  defaultedDependencies,
  isAnswered,
  isRoot,
  itemsInModule,
  moduleProgress,
  orderItems,
  runCounts,
} from "@/features/discovery/progress"
import { useDiscovery } from "@/features/discovery/use-discovery"
import { Markdown } from "@/features/prompt/markdown/markdown"
import { MermaidBlock } from "@/features/prompt/markdown/mermaid-block"
import { cn } from "@/lib/utils"
import { viewUrl } from "@/lib/view-url"
import { useSyncStore } from "@/stores/use-sync-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

/** What the centre column is showing. */
type Focus = { kind: "roots" } | { kind: "rules" } | { kind: "module"; name: string }

/**
 * The artifact tabs, in the order somebody reads them: what exists, what it
 * means, what it should do, what is wrong with it, how it moves. Kinds the
 * server invents later still get a tab — appended, labelled with the raw kind —
 * because a file nobody can open is a file that may as well not have been
 * written.
 */
const KIND_LABEL: Record<string, string> = {
  inventory: "Inventory",
  kb: "KB",
  features: "Features",
  issues: "Issues",
  flows: "Flows",
  weave: ".weave",
}
const KIND_ORDER = Object.keys(KIND_LABEL)

export function DiscoveryView({ project }: { project: Project }) {
  const remoteId = useSyncStore((s) => s.links[project.id] ?? null)
  const discovery = useDiscovery(remoteId)
  const { items, run, loading, error } = discovery
  const [focus, setFocus] = useState<Focus>({ kind: "roots" })

  const roots = useMemo(() => orderItems(items.filter(isRoot)), [items])
  const rules = useMemo(() => items.filter((item) => item.family === "RULE"), [items])
  const modules = useMemo(() => moduleProgress(items), [items])
  const counts = useMemo(() => runCounts(items), [items])
  const keyed = useMemo(() => byKey(items), [items])

  const shown = useMemo(() => {
    if (focus.kind === "roots") return roots
    if (focus.kind === "rules") return orderItems(rules)
    return orderItems(itemsInModule(items, focus.name))
  }, [focus, items, roots, rules])

  const title =
    focus.kind === "roots"
      ? "Root questions"
      : focus.kind === "rules"
        ? "Standing rules"
        : focus.name
  const answeredHere = shown.filter(isAnswered).length
  const acceptable = shown.filter((item) => !item.answer && item.proposed !== null)

  if (!remoteId) {
    return (
      <EmptyState
        icon={<Compass />}
        title="Sign in and sync this project first"
        description="Discovery lives on the server — the questions are written by weaver against your account's copy of this project, not the one in this browser."
      />
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<Compass />}
        title="Could not load discovery"
        description={error}
        action={
          <Button size="sm" variant="outline" onClick={discovery.reload}>
            <RefreshCw />
            Try again
          </Button>
        }
      />
    )
  }

  if (!run) {
    return (
      <EmptyState
        icon={<Compass />}
        title="No discovery run yet"
        description="Run /prompt-studio:discover in the repo you are building. It reads the code, writes the question tree, and pushes it here."
      />
    )
  }

  return (
    <PanelGroup autoSaveId="ps-panels-discovery" direction="horizontal" className="h-full">
      <Panel id="rail" order={1} defaultSize={22} minSize={16} maxSize={34}>
        <div className="flex h-full flex-col border-r border-border bg-card">
          <PanelHeader
            title={run.label || "Discovery"}
            count={`${counts.answered}/${counts.total}`}
            actions={
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={discovery.reload}
                aria-label="Reload discovery"
              >
                <RefreshCw />
              </Button>
            }
          />
          <PanelBody className="space-y-4">
            <section className="space-y-1">
              <SectionLabel>
                Root questions {roots.filter(isAnswered).length}/{roots.length}
              </SectionLabel>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Nothing depends on these — they decide what the rest of the tree means.
              </p>
              <ul className="space-y-0.5 pt-1">
                {roots.map((root) => (
                  <li key={root.id}>
                    <button
                      type="button"
                      onClick={() => setFocus({ kind: "roots" })}
                      className={cn(
                        "flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug transition-colors hover:bg-muted/60",
                        focus.kind === "roots" && "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1 size-1.5 shrink-0 rounded-full",
                          isAnswered(root) ? "bg-success" : "bg-warning"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{root.title}</span>
                    </button>
                  </li>
                ))}
                {!roots.length && (
                  <li className="px-1.5 text-[11px] text-muted-foreground">None in this run.</li>
                )}
              </ul>
            </section>

            <section className="space-y-1 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>
                  Standing rules {rules.filter(isAnswered).length}/{rules.length}
                </SectionLabel>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!rules.some((rule) => !rule.answer && rule.proposed !== null)}
                  onClick={() => void discovery.acceptDefaults(rules)}
                >
                  Accept all rules
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setFocus({ kind: "rules" })}
                className={cn(
                  "w-full rounded-md px-1.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/60",
                  focus.kind === "rules" && "bg-muted text-foreground"
                )}
              >
                Conventions the build follows everywhere. Review them, or take them all.
              </button>
            </section>

            <section className="space-y-0.5 border-t border-border pt-3">
              <SectionLabel className="mb-1">Modules</SectionLabel>
              {modules.map((module) => (
                <button
                  key={module.name}
                  type="button"
                  onClick={() => setFocus({ kind: "module", name: module.name })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-muted/60",
                    focus.kind === "module" && focus.name === module.name && "bg-muted"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{module.name}</span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      module.answered === module.total
                        ? "text-success"
                        : "text-muted-foreground"
                    )}
                  >
                    {module.answered}/{module.total}
                  </span>
                </button>
              ))}
              {!modules.length && (
                <p className="px-1.5 text-[11px] text-muted-foreground">None in this run.</p>
              )}
            </section>
          </PanelBody>
        </div>
      </Panel>

      <ResizeHandle />

      <Panel id="questions" order={2} defaultSize={50} minSize={30}>
        <div className="flex h-full min-w-0 flex-col">
          <PanelHeader
            title={title}
            count={`${answeredHere}/${shown.length}`}
            actions={
              <Button
                size="sm"
                variant="outline"
                disabled={!acceptable.length}
                onClick={() => void discovery.acceptDefaults(acceptable)}
              >
                Accept all defaults ({acceptable.length})
              </Button>
            }
          />
          <PanelBody className="space-y-2">
            {shown.map((item) => (
              <QuestionCard
                key={item.id}
                item={item}
                defaulted={defaultedDependencies(item, keyed)}
                onAnswer={(body) => void discovery.answer(item, body)}
              />
            ))}
            {!shown.length && (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Nothing here.
              </p>
            )}
          </PanelBody>
        </div>
      </Panel>

      <ResizeHandle />

      <Panel id="artifacts" order={3} defaultSize={28} minSize={18} maxSize={44}>
        <ArtifactPane project={project} discovery={discovery} />
      </Panel>
    </PanelGroup>
  )
}

function ArtifactPane({
  project,
  discovery,
}: {
  project: Project
  discovery: ReturnType<typeof useDiscovery>
}) {
  const { artifacts, bodies, openArtifact } = discovery
  const setMode = useUiStore((s) => s.setMode)

  const kinds = useMemo(() => {
    const present = [...new Set(artifacts.map((file) => file.kind))]
    return present.sort((a, b) => {
      const left = KIND_ORDER.indexOf(a)
      const right = KIND_ORDER.indexOf(b)
      return (left === -1 ? KIND_ORDER.length : left) - (right === -1 ? KIND_ORDER.length : right)
    })
  }, [artifacts])

  const [kind, setKind] = useState<string>("")
  const active = kind || kinds[0] || ""
  const inKind = artifacts.filter((file) => file.kind === active)
  const [name, setName] = useState<string>("")
  const file = inKind.find((row) => row.name === name) ?? inKind[0]

  // Bodies are not in the list response, so the first look at a tab fetches
  // one. Nobody pays for the KB unless they open the KB.
  useEffect(() => {
    if (file) void openArtifact(file.name)
  }, [file, openArtifact])

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <PanelHeader
        title="Artifacts"
        actions={
          <Button size="sm" variant="ghost" asChild>
            {/* A real href so it can be copied and middle-clicked, but the
                click switches tabs in place — the studio is one page, and a
                navigation here would reload the whole app to show a canvas it
                is already holding. */}
            <a
              href={viewUrl("data", project.id)}
              onClick={(event) => {
                event.preventDefault()
                setMode("data")
              }}
            >
              <Database />
              Schema
            </a>
          </Button>
        }
      />
      {!artifacts.length ? (
        <EmptyState
          icon={<FileText />}
          title="Nothing pushed yet"
          description="The KB, feature list, issues and flow diagrams appear here as weaver writes them."
        />
      ) : (
        <Tabs
          value={active}
          onValueChange={(value) => {
            setKind(value)
            setName("")
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="overflow-x-auto px-2 pt-2">
            <TabsList>
              {kinds.map((row) => (
                <TabsTrigger key={row} value={row}>
                  {KIND_LABEL[row] ?? row}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Only the open tab is rendered: the file list below belongs to
              `active`, and drawing it under every kind would be the same list
              six times over. */}
          {[active].map((row) => (
            <TabsContent key={row} value={row} className="min-h-0">
              {inKind.length > 1 && (
                <div className="flex flex-wrap gap-1 px-3 pt-2">
                  {inKind.map((option) => (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => setName(option.name)}
                      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground aria-[current=true]:border-primary aria-[current=true]:text-foreground"
                      aria-current={option.name === file?.name}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              )}
              <PanelBody>
                {file ? <ArtifactBody name={file.name} body={bodies[file.name]} /> : null}
              </PanelBody>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

function ArtifactBody({ name, body }: { name: string; body: string | undefined }) {
  if (body === undefined) {
    return <Loader2 className="mx-auto mt-6 size-4 animate-spin text-muted-foreground" />
  }
  // A `.mmd` file is bare mermaid source, not a fenced block, so it goes
  // straight to the renderer; `.md` goes through the markdown renderer, which
  // draws any ```mermaid fence inside it the same way.
  if (name.endsWith(".mmd")) return <MermaidBlock code={body} />
  if (name.endsWith(".md")) return <Markdown source={body} />
  return (
    <pre className="code-surface overflow-x-auto text-[11.5px] leading-relaxed">
      <code>{body}</code>
    </pre>
  )
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="w-1 bg-border transition-colors data-[resize-handle-state=drag]:bg-primary hover:bg-primary/40" />
  )
}
