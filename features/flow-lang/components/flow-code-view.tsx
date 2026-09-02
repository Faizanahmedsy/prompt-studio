"use client"

import { AlertTriangle, ClipboardCopy, Code2, Download } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { WarningList } from "@/components/shared/feedback"
import { PanelHeader, SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useIsReadOnly } from "@/features/cloud/read-only"
import { FlowActions } from "@/features/flow-lang/components/flow-actions"
import { describeMerge, mergeDoc } from "@/features/flow-lang/merge"
import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"
import { builtInProfiles } from "@/features/stack/data/profiles"
import { copyText, downloadFile } from "@/lib/download"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, ProjectDoc } from "@/types/project"

/**
 * The code surface: the project as `.flow` source, the button that hands the
 * language to ChatGPT, and the paste-back path with a preview before commit.
 */
export function FlowCodeView({ project }: { project: Project }) {
  const source = useMemo(() => serializeFlow(project), [project])

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Flow source"
        actions={
          <>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                copyText(source)
                toast.success("Flow source copied")
              }}
            >
              <ClipboardCopy /> Copy
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                downloadFile(
                  `${project.name.toLowerCase().replace(/\s+/g, "-")}.flow`,
                  source
                )
              }
            >
              <Download /> .flow
            </Button>
          </>
        }
      />

      {/* Same pair as the header — one component, so they never drift. */}
      <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
        <FlowActions />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <pre className="code-surface whitespace-pre rounded-lg bg-surface p-3">
          {source}
        </pre>
      </div>
    </div>
  )
}

export function PasteFlowDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState("")
  const replaceDoc = useProjectStore((s) => s.replaceDoc)
  const activeId = useProjectStore((s) => s.activeId)
  const readOnly = useIsReadOnly(activeId)
  const update = useProjectStore((s) => s.update)

  const parsed = useMemo(() => (text.trim() ? parseFlow(text) : null), [text])

  const applyProfile = (doc: ProjectDoc, profileName?: string) => {
    if (!profileName) return doc
    const profile = builtInProfiles.find(
      (p) => p.name.toLowerCase() === profileName.toLowerCase()
    )
    if (!profile) return doc
    return {
      ...doc,
      stack: structuredClone(profile.stack),
      structure: structuredClone(profile.structure),
      conventions: structuredClone(profile.conventions),
    }
  }

  const commit = (mode: "replace" | "merge") => {
    if (!parsed) return
    // The store refuses the write; without this the toast would still claim it
    // worked and the person would think their paste had landed.
    if (readOnly) {
      toast.error("This project is read-only", {
        description: "You cannot import Flow source into a project you can only view.",
      })
      return
    }
    const incoming = applyProfile(parsed.doc, parsed.profile)

    if (mode === "replace") {
      replaceDoc(incoming)
      toast.success("Flow imported", {
        description: `${incoming.screens.length} screens · ${incoming.edges.length} connections${
          parsed.warnings.length ? ` · ${parsed.warnings.length} warnings` : ""
        }`,
      })
    } else {
      let summary = ""
      let broughtDesign = false
      update((doc) => {
        const report = mergeDoc(doc, incoming, parsed.themeStated)
        summary = describeMerge(report)
        broughtDesign = report.themeFields > 0
      })
      toast.success("Flow merged into this project", {
        description: `${summary}${
          parsed.warnings.length ? ` · ${parsed.warnings.length} warnings` : ""
        }`,
        // A design that arrived with the file is a suggestion, and a suggestion
        // nobody looks at is the same as no suggestion. The toast is where the
        // person already is, so the way to it goes here.
        ...(broughtDesign
          ? {
              action: {
                label: "Review design",
                onClick: () => useUiStore.getState().setMode("theme"),
              },
            }
          : {}),
      })
    }

    setText("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Paste Flow source</DialogTitle>
          <DialogDescription>
            Paste a full Flow file or a fragment. It is parsed before anything is
            applied — nothing changes until you choose replace or merge. Merge
            matches screens by key, so a fragment lands on the screens you
            already have instead of duplicating them.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'app "My product" {\n  target claude-code\n}\n\nscreen login "Sign In" { template auth; layout auth-split }'}
          className="code-surface h-56 resize-none"
          spellCheck={false}
          autoFocus
        />

        {parsed && (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Code2 className="size-4 text-primary" />
              <strong className="font-medium">{parsed.doc.name}</strong>
              <span className="text-muted-foreground">
                {parsed.doc.screens.length} screens · {parsed.doc.edges.length}{" "}
                connections
                {parsed.doc.modules.length > 0 &&
                  ` · ${parsed.doc.modules.length} modules`}
                {parsed.doc.sections.length > 0 &&
                  ` · ${parsed.doc.sections.length} sections`}
                {parsed.doc.entities.length > 0 &&
                  ` · ${parsed.doc.entities.length} tables`}
                {parsed.doc.relations.length > 0 &&
                  ` · ${parsed.doc.relations.length} relations`}
              </span>
            </div>

            {parsed.errors.length > 0 && (
              <ul className="space-y-1">
                {parsed.errors.map((issue) => (
                  <li
                    key={`${issue.line}-${issue.message}`}
                    className="flex items-start gap-2 rounded-md bg-destructive-soft/60 px-2 py-1.5 text-[11px]"
                  >
                    <AlertTriangle className="mt-px size-3.5 shrink-0 text-destructive" />
                    <span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        line {issue.line}
                      </span>{" "}
                      {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <WarningList
              warnings={parsed.warnings.map(
                (issue) => `line ${issue.line}: ${issue.message}`
              )}
            />

            {parsed.doc.screens.length > 0 && (
              <div>
                <SectionLabel>Screens found</SectionLabel>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {parsed.doc.screens.map((s) => s.title).join(" · ")}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            // A fragment that only adds tables is a fragment: the data model
            // is merged by table key the same way screens are merged by theirs.
            disabled={
              !parsed ||
              (parsed.doc.screens.length === 0 && parsed.doc.entities.length === 0)
            }
            onClick={() => commit("merge")}
          >
            Merge into project
          </Button>
          <Button
            disabled={
              !parsed ||
              (!parsed.doc.screens.length &&
                !parsed.doc.sections.length &&
                !parsed.doc.entities.length)
            }
            onClick={() => commit("replace")}
          >
            Replace project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
