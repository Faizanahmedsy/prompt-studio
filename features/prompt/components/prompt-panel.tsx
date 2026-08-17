"use client"

import {
  Check,
  Copy,
  Download,
  FileDiff,
  History,
  Printer,
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
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { diffLines, diffStats } from "@/features/prompt/engine/diff"
import { getTarget } from "@/features/prompt/engine/targets"
import { copyText, downloadFile } from "@/lib/download"
import { countWords, estimateTokens } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Surface } from "@/types/project"
import { cn } from "@/lib/utils"

export function PromptPanel({ project }: { project: Project }) {
  const [lastGenerated, setLastGenerated] = useState("")
  const [copied, setCopied] = useState(false)
  const saveVersion = useProjectStore((s) => s.saveVersion)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const mode = useUiStore((s) => s.mode)

  // The prompt follows the tab: each surface is its own build, so generating
  // while looking at Mobile must not hand over the web app's screens.
  const surface: Surface =
    mode === "mobile" || mode === "backend" ? mode : "web"
  const built = useMemo(
    () => buildPrompt(project, { surface }),
    [project, surface]
  )
  const target = getTarget(project.target)

  const diff = useMemo(
    () => diffLines(lastGenerated, built.text),
    [lastGenerated, built.text]
  )
  const stats = diffStats(diff)

  const generate = async () => {
    await copyText(built.text)
    setLastGenerated(built.text)
    saveVersion(`Generated for ${target.name}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    toast.success("Prompt copied", {
      description: `${estimateTokens(built.text).toLocaleString()} tokens · saved as a version`,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Prompt"
        actions={
          <>
            <Hint label="Copy markdown">
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => {
                  copyText(built.text)
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
                    built.text,
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
        <Meter label="chars" value={built.text.length} />
        <Meter label="words" value={countWords(built.text)} />
        <Meter label="~tokens" value={estimateTokens(built.text)} highlight />
        <span className="ml-auto truncate">{target.name}</span>
      </div>

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
          <PanelBody className="space-y-3">
            {built.blocks.map((block) => (
              <section key={block.id} className="space-y-1">
                <SectionLabel>{block.title}</SectionLabel>
                <pre className="code-surface whitespace-pre-wrap break-words rounded-lg bg-surface p-2.5 text-foreground/90">
                  {block.body}
                </pre>
              </section>
            ))}
          </PanelBody>
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
