"use client"

import { FileInput, MessageSquareCode } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { copyText } from "@/lib/download"

import { PasteFlowDialog } from "./flow-code-view"

/**
 * The two actions the whole tool exists to serve — hand the language to
 * ChatGPT, and take back what it wrote. They live in the header rather than a
 * panel because everything else is downstream of them.
 */
export function FlowActions() {
  const [pasteOpen, setPasteOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            copyText(buildAuthoringPrompt())
            toast.success("Diagram-syntax prompt copied", {
              description:
                "Paste it into ChatGPT with the client requirements, then paste the Flow file it returns back here.",
            })
          }}
          className="h-9 gap-2 px-3 font-semibold shadow-sm"
        >
          <MessageSquareCode className="size-4" />
          <span className="hidden md:inline">Copy syntax prompt</span>
          <span className="md:hidden">Syntax</span>
        </Button>

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
