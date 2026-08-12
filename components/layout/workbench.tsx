"use client"

import { Keyboard, Library, PanelRight } from "lucide-react"
import { useEffect, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

import { Inspector } from "@/components/layout/inspector"
import { TopBar } from "@/components/layout/top-bar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/misc"
import { FlowCanvas } from "@/features/builder/components/flow-canvas"
import { OutlineList } from "@/features/builder/components/outline-list"
import { FlowCodeView } from "@/features/flow-lang/components/flow-code-view"
import { LandingPreview } from "@/features/landing/components/landing-preview"
import { LibraryPanel } from "@/features/library/components/library-panel"
import { CommandPalette } from "@/features/palette/command-palette"
import { ShortcutsOverlay } from "@/features/palette/shortcuts-overlay"
import { useWorkbenchHotkeys } from "@/features/palette/use-hotkeys"
import { PromptPanel } from "@/features/prompt/components/prompt-panel"
import { useShareImport } from "@/features/projects/use-share-import"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

/** Below this width the three panes become sheets and the canvas becomes a list. */
const DESKTOP = 1024

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP}px)`)
    const sync = () => setIsDesktop(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  return isDesktop
}

export function Workbench({ project }: { project: Project }) {
  const ui = useUiStore()
  const isDesktop = useIsDesktop()
  const hydrated = useProjectStore((s) => s.hydrated)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  useWorkbenchHotkeys()
  useShareImport(hydrated)

  // Opening a screen on a phone should surface the inspector, not hide it.
  useEffect(() => {
    if (!isDesktop && ui.selectedId) setInspectorOpen(true)
  }, [isDesktop, ui.selectedId])

  const centre =
    ui.mode === "code" ? (
      <FlowCodeView project={project} />
    ) : ui.mode === "landing" ? (
      <div className="h-full overflow-y-auto">
        <LandingPreview project={project} />
      </div>
    ) : isDesktop ? (
      <FlowCanvas project={project} />
    ) : (
      <div className="h-full overflow-y-auto">
        <OutlineList project={project} />
      </div>
    )

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <TopBar project={project} />

        {isDesktop ? (
          <PanelGroup
            direction="horizontal"
            className="min-h-0 flex-1"
            onLayout={(sizes) => ui.setPanelSizes(sizes)}
          >
            {ui.leftOpen && (
              <>
                <Panel
                  defaultSize={ui.panelSizes[0] ?? 20}
                  minSize={14}
                  maxSize={30}
                  className="border-r border-border bg-card"
                >
                  <LibraryPanel project={project} />
                </Panel>
                <ResizeHandle />
              </>
            )}

            <Panel
              defaultSize={ui.panelSizes[1] ?? 54}
              minSize={30}
              className="relative min-w-0"
            >
              {centre}
            </Panel>

            {ui.rightOpen && (
              <>
                <ResizeHandle />
                <Panel
                  defaultSize={ui.panelSizes[2] ?? 26}
                  minSize={18}
                  maxSize={40}
                  className="border-l border-border bg-card"
                >
                  <PanelGroup direction="vertical">
                    <Panel defaultSize={52} minSize={25}>
                      <Inspector project={project} />
                    </Panel>
                    <ResizeHandle vertical />
                    <Panel defaultSize={48} minSize={25}>
                      <PromptPanel project={project} />
                    </Panel>
                  </PanelGroup>
                </Panel>
              </>
            )}
          </PanelGroup>
        ) : (
          <>
            <main className="min-h-0 flex-1 overflow-hidden">{centre}</main>

            <nav className="flex shrink-0 items-center justify-around border-t border-border bg-card px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 flex-col gap-0.5 text-[10px]"
                onClick={() => setLibraryOpen(true)}
              >
                <Library />
                Library
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 flex-col gap-0.5 text-[10px]"
                onClick={() => ui.setPalette(true)}
              >
                <Keyboard />
                Commands
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 flex-col gap-0.5 text-[10px]"
                onClick={() => setInspectorOpen(true)}
              >
                <PanelRight />
                Inspect
              </Button>
            </nav>

            <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
              <SheetContent side="left" className="p-0">
                <SheetTitle className="sr-only">Library</SheetTitle>
                <LibraryPanel project={project} />
              </SheetContent>
            </Sheet>

            <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
              <SheetContent side="bottom" className="h-[85dvh] p-0">
                <SheetTitle className="sr-only">Inspector</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1">
                    <Inspector project={project} />
                  </div>
                  <div className="h-[45%] shrink-0 border-t border-border">
                    <PromptPanel project={project} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}

        <CommandPalette project={project} />
        <ShortcutsOverlay />
      </div>
    </TooltipProvider>
  )
}

function ResizeHandle({ vertical = false }: { vertical?: boolean }) {
  return (
    <PanelResizeHandle
      className={
        vertical
          ? "h-1 bg-border transition-colors data-[resize-handle-state=drag]:bg-primary hover:bg-primary/40"
          : "w-1 bg-border transition-colors data-[resize-handle-state=drag]:bg-primary hover:bg-primary/40"
      }
    />
  )
}
