"use client"

import {
  ArrowRight,
  Code2,
  Download,
  FileInput,
  FilePlus2,
  LayoutGrid,
  LayoutPanelTop,
  Link2,
  MessageSquareCode,
  Moon,
  Plus,
  Redo2,
  Sun,
  Undo2,
  Wand2,
  Workflow,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState } from "react"
import { toast } from "sonner"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandScroll,
} from "@/components/ui/command"
import {
  addScreen,
  addSection,
  arrangeScreens,
} from "@/features/builder/utils/actions"
import { PasteFlowDialog } from "@/features/flow-lang/components/flow-code-view"
import { buildAuthoringPrompt } from "@/features/flow-lang/authoring-prompt"
import { screenTemplates } from "@/features/library/data/templates"
import { sectionTypes } from "@/features/library/data/section-types"
import { starters } from "@/features/library/data/starters"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { copyText, downloadFile } from "@/lib/download"
import { encodeShare, shareUrl } from "@/lib/share-codec"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import { SCHEMA_VERSION, type Project } from "@/types/project"

export function CommandPalette({ project }: { project: Project }) {
  const open = useUiStore((s) => s.paletteOpen)
  const setPalette = useUiStore((s) => s.setPalette)
  const setMode = useUiStore((s) => s.setMode)
  const select = useUiStore((s) => s.select)
  const store = useProjectStore()
  const { resolvedTheme, setTheme } = useTheme()
  const [pasteOpen, setPasteOpen] = useState(false)

  const run = (action: () => void) => {
    setPalette(false)
    // Let the dialog close before the action re-renders the tree.
    requestAnimationFrame(action)
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setPalette}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandScroll>
          <CommandEmpty>No matching command.</CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() =>
                run(async () => {
                  const { text } = buildPrompt(project)
                  await copyText(text)
                  store.saveVersion("Generated from palette")
                  toast.success("Prompt copied")
                })
              }
            >
              <Wand2 /> Generate prompt and copy
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => {
                  copyText(buildAuthoringPrompt())
                  toast.success("Diagram-syntax prompt copied")
                })
              }
            >
              <MessageSquareCode /> Copy prompt for diagram syntax
            </CommandItem>
            <CommandItem onSelect={() => run(() => setPasteOpen(true))}>
              <FileInput /> Paste Flow source
            </CommandItem>
            <CommandItem onSelect={() => run(() => arrangeScreens())}>
              <LayoutGrid /> Auto-arrange canvas
            </CommandItem>
            <CommandItem onSelect={() => run(() => store.undo())}>
              <Undo2 /> Undo
            </CommandItem>
            <CommandItem onSelect={() => run(() => store.redo())}>
              <Redo2 /> Redo
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(async () => {
                  const token = await encodeShare({
                    kind: "prompt-studio/project",
                    schemaVersion: SCHEMA_VERSION,
                    project,
                  })
                  await copyText(shareUrl(token))
                  toast.success("Share link copied")
                })
              }
            >
              <Link2 /> Copy share link
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() =>
                  downloadFile(
                    `${project.name.toLowerCase().replace(/\s+/g, "-")}-prompt.md`,
                    buildPrompt(project).text,
                    "text/markdown;charset=utf-8"
                  )
                )
              }
            >
              <Download /> Download prompt as markdown
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
              }
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />} Toggle theme
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Go to">
            <CommandItem onSelect={() => run(() => setMode("flow"))}>
              <Workflow /> Flow canvas
            </CommandItem>
            <CommandItem onSelect={() => run(() => setMode("landing"))}>
              <LayoutPanelTop /> Landing sections
            </CommandItem>
            <CommandItem onSelect={() => run(() => setMode("code"))}>
              <Code2 /> Flow source
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Add screen">
            {screenTemplates.map((template) => (
              <CommandItem
                key={template.id}
                value={`add screen ${template.name} ${template.description}`}
                onSelect={() =>
                  run(() => {
                    setMode("flow")
                    const id = addScreen(template.id)
                    if (id) select(id)
                  })
                }
              >
                <Plus /> {template.name}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Add section">
            {sectionTypes.map((section) => (
              <CommandItem
                key={section.id}
                value={`add section ${section.name} ${section.description}`}
                onSelect={() =>
                  run(() => {
                    setMode("landing")
                    const id = addSection(section.id)
                    if (id) select(id)
                  })
                }
              >
                <Plus /> {section.name}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Projects">
            {store.projects
              .filter((entry) => entry.id !== project.id)
              .map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`open project ${entry.name}`}
                  onSelect={() => run(() => store.setActive(entry.id))}
                >
                  <ArrowRight /> {entry.name}
                </CommandItem>
              ))}
            {starters.map((starter) => (
              <CommandItem
                key={starter.id}
                value={`new project ${starter.name}`}
                onSelect={() => run(() => store.createProject(starter.id))}
              >
                <FilePlus2 /> New — {starter.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandScroll>
      </CommandDialog>

      <PasteFlowDialog open={pasteOpen} onOpenChange={setPasteOpen} />
    </>
  )
}
