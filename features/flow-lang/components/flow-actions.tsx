"use client"

import {
  ChevronDown,
  FileInput,
  FolderSearch,
  MessageSquareCode,
  PlusSquare,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { buildFragmentPrompt } from "@/features/flow-lang/fragment-prompt"
import { buildReverseEnginePrompt } from "@/features/flow-lang/reverse-prompt"
import { copyText } from "@/lib/download"
import { useActiveProject } from "@/stores/use-project-store"

import { PasteFlowDialog } from "./flow-code-view"

/**
 * The two actions the whole tool exists to serve — hand the language to a
 * model, and take back what it wrote. They live in the header rather than a
 * panel because everything else is downstream of them.
 *
 * There are three prompts because there are three ways a diagram starts: from
 * a client's requirements, from a codebase that already exists, or as a piece
 * added to a diagram already on screen. They share one button because a row of
 * three competing primaries reads as no primary at all.
 */
export function FlowActions() {
  const [pasteOpen, setPasteOpen] = useState(false)
  const project = useActiveProject()

  const copy = (label: string, text: string, description: string) => {
    copyText(text)
    toast.success(`${label} copied`, { description })
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 gap-2 px-3 font-semibold shadow-sm">
              <MessageSquareCode className="size-4" />
              <span className="hidden md:inline">Copy prompt</span>
              <span className="md:hidden">Prompt</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
              Paste one of these into ChatGPT or Claude Code, then bring the Flow
              file it writes back here.
            </DropdownMenuLabel>

            <PromptItem
              icon={<MessageSquareCode className="size-4" />}
              title="New flow from requirements"
              detail="For a project that does not exist yet. Give it the client's requirements."
              onSelect={() =>
                copy(
                  "Diagram-syntax prompt",
                  buildAuthoringPrompt(project),
                  "Paste it into ChatGPT with the client requirements."
                )
              }
            />

            <PromptItem
              icon={<FolderSearch className="size-4" />}
              title="From an existing codebase"
              detail="Run inside the repo with Claude Code. It reads the code and writes the real flow — frontend or backend."
              onSelect={() =>
                copy(
                  "Reverse-engineer prompt",
                  buildReverseEnginePrompt(),
                  "Run it with Claude Code inside the repository you want mapped."
                )
              }
            />

            <PromptItem
              icon={<PlusSquare className="size-4" />}
              title="Fragment to merge in"
              detail={
                project
                  ? `Adds to this project. Knows its ${project.screens.length} screen${project.screens.length === 1 ? "" : "s"}, so the fragment attaches instead of duplicating.`
                  : "Adds to the current project — open or create one first."
              }
              disabled={!project}
              onSelect={() => {
                if (!project) return
                copy(
                  "Fragment prompt",
                  buildFragmentPrompt(project),
                  "Describe the feature to add, then paste the fragment back and choose Merge."
                )
              }}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setPasteOpen(true)}
          className="h-9 gap-2 border-primary/40 px-3 font-semibold text-primary shadow-sm hover:border-primary hover:bg-primary-soft/60 hover:text-primary"
        >
          <FileInput className="size-4" />
          <span className="hidden md:inline">Paste Flow</span>
          <span className="md:hidden">Paste</span>
        </Button>
      </div>

      <PasteFlowDialog open={pasteOpen} onOpenChange={setPasteOpen} />
    </>
  )
}

function PromptItem({
  icon,
  title,
  detail,
  onSelect,
  disabled,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      disabled={disabled}
      className="items-start gap-2.5 py-2"
    >
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
          {detail}
        </span>
      </span>
    </DropdownMenuItem>
  )
}
