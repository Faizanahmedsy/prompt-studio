"use client"

import {
  Check,
  Copy,
  Download,
  FileDiff,
  History,
  Pencil,
  Printer,
  RotateCcw,
  Wand2,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { WarningList } from "@/components/shared/feedback"
import { PanelBody, PanelHeader, SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/misc"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildProjectPrompt } from "@/features/prompt/engine/build-project-prompt"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { diffLines, diffStats } from "@/features/prompt/engine/diff"
import { isMultiBuild, selectedSurfaces } from "@/features/prompt/engine/monorepo"
import { getTarget } from "@/features/prompt/engine/targets"
import { copyText, downloadFile } from "@/lib/download"
import { cn, countWords, estimateTokens } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { usePromptDraftStore } from "@/stores/use-prompt-draft-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Surface } from "@/types/project"

export function PromptPanel({ project }: { project: Project }) {
  const [lastGenerated, setLastGenerated] = useState("")
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const saveVersion = useProjectStore((s) => s.saveVersion)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const mode = useUiStore((s) => s.mode)

  // The prompt follows the tab: each surface is its own build, so generating
  // while looking at Mobile must not hand over the web app's screens.
  const surface: Surface =
    mode === "mobile" || mode === "backend" ? mode : "web"
  // A project that ships more than one build has one deliverable — the whole
  // system, wired together — so that is what the panel offers by default. The
  // per-surface build stays one click away for anyone working on a single app.
  const multi = isMultiBuild(project)
  const [scope, setScope] = useState<"project" | "surface">("project")
  const wholeProject = multi && scope === "project"

  const built = useMemo(
    () => (wholeProject ? buildProjectPrompt(project) : buildPrompt(project, { surface })),
    [project, surface, wholeProject]
  )
  const target = getTarget(project.target)

  // Subscribing to the whole map rather than a selector result: the key depends
  // on the surface, and a selector returning `drafts[key]` re-runs anyway.
  const drafts = usePromptDraftStore((s) => s.drafts)
  const setDraft = usePromptDraftStore((s) => s.set)
  const clearDraft = usePromptDraftStore((s) => s.clear)
  const draft = drafts[`${project.id}:${surface}`] ?? null
  const edited = draft !== null
  /**
   * What every action downstream works on. Once someone has edited the prompt,
   * the edit *is* the prompt — copying, downloading and the token count all
   * follow it, because handing over text that differs from what is on screen
   * is the one thing an editable field must never do.
   */
  const text = draft ?? built.text
  const stale = usePromptDraftStore((s) => s.isStale(project.id, surface, built.text))

  const diff = useMemo(() => diffLines(lastGenerated, text), [lastGenerated, text])
  const stats = diffStats(diff)

  const generate = async () => {
    await copyText(text)
    setLastGenerated(text)
    saveVersion(`Prompt generated for ${target.name}`, "generated")
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    toast.success("Prompt copied", {
      description: `${estimateTokens(text).toLocaleString()} tokens · saved as a version`,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Prompt"
        actions={
          <>
            <Hint label={editing ? "Done editing" : "Edit the prompt by hand"}>
              <Button
                size="icon-xs"
                variant={editing ? "secondary" : "ghost"}
                onClick={() => {
                  // Entering the editor materialises the draft, so the very
                  // first keystroke is not also a state transition.
                  if (!editing && !edited) setDraft(project.id, surface, built.text, built.text)
                  setEditing((value) => !value)
                }}
                aria-label={editing ? "Stop editing prompt" : "Edit prompt"}
                aria-pressed={editing}
              >
                {editing ? <Check /> : <Pencil />}
              </Button>
            </Hint>
            <Hint label="Copy markdown">
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => {
                  copyText(text)
                  toast.success("Copied to clipboard")
                }}
                aria-label="Copy prompt"
              >
                <Copy />
              </Button>
            </Hint>
            <Hint label="Download .md">
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() =>
                  downloadFile(
                    `${project.name.toLowerCase().replace(/\s+/g, "-")}-prompt.md`,
                    text,
                    "text/markdown;charset=utf-8"
                  )
                }
                aria-label="Download prompt"
              >
                <Download />
              </Button>
            </Hint>
            <Hint label="Print view">
              <Button size="icon-xs" variant="ghost" asChild>
                <Link href="/print" target="_blank" aria-label="Open print view">
                  <Printer />
                </Link>
              </Button>
            </Hint>
          </>
        }
      />

      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
        <Meter label="chars" value={text.length} />
        <Meter label="words" value={countWords(text)} />
        <Meter label="~tokens" value={estimateTokens(text)} highlight />
        {multi && (
          <span className="ml-auto flex items-center gap-1">
            <ScopeButton
              active={scope === "project"}
              onClick={() => setScope("project")}
              label={`Whole project · ${selectedSurfaces(project).length} builds`}
            />
            <ScopeButton
              active={scope === "surface"}
              onClick={() => setScope("surface")}
              label={`${surface} only`}
            />
          </span>
        )}
        <span className={cn("truncate", !multi && "ml-auto")}>{target.name}</span>
      </div>

      {edited && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-warning-soft/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">
            {stale
              ? "Edited by hand — the build has moved on since."
              : "Edited by hand — this text is used instead of the build."}
          </span>
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto shrink-0"
            onClick={() => {
              clearDraft(project.id, surface)
              setEditing(false)
              toast.success("Back to the generated prompt")
            }}
          >
            <RotateCcw /> Reset
          </Button>
        </div>
      )}

      <Tabs defaultValue="preview" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-3 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            {advanced && (
              <TabsTrigger value="diff">
                <FileDiff />
                Diff
                {(stats.added > 0 || stats.removed > 0) && lastGenerated && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    +{stats.added}/−{stats.removed}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="checks">
              Checks
              {built.warnings.length > 0 && (
                <span className="ml-1 rounded-full bg-warning-soft px-1 text-[10px] text-warning">
                  {built.warnings.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" className="min-h-0">
          {editing ? (
            /**
             * One textarea over the whole prompt, not a field per block.
             *
             * The blocks are a rendering of the document, so editing one in
             * place would raise the question of what happens to it when the
             * document changes — and there is no honest answer. Editing the
             * finished text has an honest answer: it is yours now, and the
             * banner tells you when the build beneath it has moved on.
             */
            <div className="flex h-full min-h-0 flex-col">
              <textarea
                value={text}
                onChange={(event) =>
                  setDraft(project.id, surface, event.target.value, built.text)
                }
                spellCheck={false}
                aria-label="Generated prompt"
                className="code-surface min-h-0 flex-1 resize-none border-0 bg-surface p-3 text-foreground/90 outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ) : (
            <PanelBody className="space-y-3">
              {edited ? (
                <pre className="code-surface whitespace-pre-wrap break-words rounded-lg bg-surface p-2.5 text-foreground/90">
                  {text}
                </pre>
              ) : (
                built.blocks.map((block) => (
                  <section key={block.id} className="space-y-1">
                    <SectionLabel>{block.title}</SectionLabel>
                    <pre className="code-surface whitespace-pre-wrap break-words rounded-lg bg-surface p-2.5 text-foreground/90">
                      {block.body}
                    </pre>
                  </section>
                ))
              )}
            </PanelBody>
          )}
        </TabsContent>

        <TabsContent value="diff" className={cn("min-h-0", !advanced && "hidden")}>
          <PanelBody>
            {!lastGenerated ? (
              <p className="text-xs text-muted-foreground">
                Generate once and every later change shows up here as a diff.
              </p>
            ) : (
              <pre className="code-surface overflow-x-auto rounded-lg bg-surface p-2.5">
                {diff.map((line, index) => (
                  <div
                    key={index}
                    className={cn(
                      "whitespace-pre-wrap break-words px-1",
                      line.type === "add" && "bg-success-soft/60 text-foreground",
                      line.type === "del" &&
                        "bg-destructive-soft/60 text-muted-foreground line-through",
                      line.type === "same" && "text-muted-foreground/70"
                    )}
                  >
                    {line.type === "add" ? "+ " : line.type === "del" ? "− " : "  "}
                    {line.text || " "}
                  </div>
                ))}
              </pre>
            )}
          </PanelBody>
        </TabsContent>

        <TabsContent value="checks" className="min-h-0">
          <PanelBody className="space-y-3">
            {built.warnings.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-success">
                <Check className="size-4" /> Nothing to flag — the brief is complete.
              </p>
            ) : (
              <WarningList warnings={built.warnings} />
            )}
            <div className="rounded-lg border border-border p-2">
              <SectionLabel>Blocks included</SectionLabel>
              <ul className="mt-1 space-y-0.5">
                {built.blocks.map((block) => (
                  <li key={block.id} className="text-[11px] text-muted-foreground">
                    {block.title}
                  </li>
                ))}
              </ul>
            </div>
          </PanelBody>
        </TabsContent>
      </Tabs>

      <div className="shrink-0 border-t border-border p-3">
        <Button className="w-full" onClick={generate}>
          {copied ? <Check /> : <Wand2 />}
          {copied ? "Copied" : "Generate prompt"}
        </Button>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <History className="size-3" /> Generating copies it and saves a version
        </p>
      </div>
    </div>
  )
}

function Meter({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <span className="flex items-baseline gap-1">
      <span
        className={cn(
          "font-mono text-xs tabular-nums",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value.toLocaleString()}
      </span>
      <span>{label}</span>
    </span>
  )
}

/** Whole system, or just the build on screen. */
function ScopeButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors",
        active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  )
}
