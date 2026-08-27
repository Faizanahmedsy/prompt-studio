"use client"

import { Keyboard, Library, PanelRight } from "lucide-react"
import { useEffect, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

import { GlobalSettingsBar } from "@/components/layout/global-settings-bar"
import { Inspector } from "@/components/layout/inspector"
import { TopBar } from "@/components/layout/top-bar"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/misc"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { FlowCanvas } from "@/features/builder/components/flow-canvas"
import { OutlineList } from "@/features/builder/components/outline-list"
import { ReadOnlyBanner } from "@/features/cloud/components/read-only-banner"
import { useLiveProject } from "@/features/cloud/use-live-project"
import { useProjectSync } from "@/features/cloud/use-project-sync"
import { DataCanvas } from "@/features/data/components/data-canvas"
import { EntityList } from "@/features/data/components/entity-list"
import { FlowCodeView } from "@/features/flow-lang/components/flow-code-view"
import { LandingPreview } from "@/features/landing/components/landing-preview"
import { LibraryPanel } from "@/features/library/components/library-panel"
import { CommandPalette } from "@/features/palette/command-palette"
import { ShortcutsOverlay } from "@/features/palette/shortcuts-overlay"
import { useWorkbenchHotkeys } from "@/features/palette/use-hotkeys"
import { useProjectLink } from "@/features/projects/use-project-link"
import { useShareImport } from "@/features/projects/use-share-import"
import { PromptPanel } from "@/features/prompt/components/prompt-panel"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Surface } from "@/types/project"

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
  // After the snapshot import, so a URL carrying both resolves to the live
  // project rather than a copy of it.
  useProjectLink(hydrated)
  // Everything the account can see, kept in step over HTTP...
  useProjectSync()
  // ...and the one project on screen, kept live over a websocket.
  const live = useLiveProject(project)

  // Easy mode has no library pane at all — adding happens on the canvas — so
  // the left slot holds the inspector there and the library in Advanced.
  // Either way it is the same slot and the same toggle: it used to be drawn
  // unconditionally in Easy, so the button in the top bar did nothing and the
  // one panel a person most wants out of the way could not be closed.
  const advanced = ui.experience === "advanced"
  const showLeft = ui.leftOpen

  // Opening a screen on a phone should surface the inspector, not hide it.
  useEffect(() => {
    if (!isDesktop && ui.selectedId) setInspectorOpen(true)
  }, [isDesktop, ui.selectedId])

  // Web / Mobile / Backend are surfaces — the same canvas, filtered to one
  // build. Landing and Code are their own surfaces of a different kind.
  const surface: Surface =
    ui.mode === "mobile" || ui.mode === "backend" ? ui.mode : "web"

  const canvas =
    ui.mode === "code" ? (
      <FlowCodeView project={project} />
    ) : ui.mode === "data" ? (
      // The diagram is the better way to read a schema and the worse way to
      // edit one with a thumb.
      isDesktop ? (
        <DataCanvas project={project} />
      ) : (
        <div className="h-full overflow-y-auto">
          <EntityList project={project} />
        </div>
      )
    ) : ui.mode === "landing" ? (
      <div className="h-full overflow-y-auto">
        <LandingPreview project={project} />
      </div>
    ) : isDesktop ? (
      <FlowCanvas project={project} surface={surface} />
    ) : (
      <div className="h-full overflow-y-auto">
        <OutlineList project={project} surface={surface} />
      </div>
    )

  // Easy mode floats the project-wide settings over the canvas instead of
  // mixing them into the inspector, where they read as properties of whatever
  // happens to be selected.
  const centre = advanced ? (
    canvas
  ) : (
    <div className="relative h-full">
      {canvas}
      <GlobalSettingsBar project={project} />
    </div>
  )

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <TopBar project={project} live={live} />
        {/* Above the panels, not inside one: it is true of the whole document,
            not of whichever pane happens to be open. */}
        <ReadOnlyBanner projectId={project.id} />

        {isDesktop ? (
          <PanelGroup
            // `autoSaveId` lets the library persist sizes to localStorage
            // itself. Feeding sizes through our own store instead caused
            // onLayout → setState → new defaultSize → onLayout to loop until
            // the renderer died.
            autoSaveId={advanced ? "ps-panels-advanced" : "ps-panels-easy"}
            direction="horizontal"
            className="min-h-0 flex-1"
          >
            {/* Advanced: library. Easy: the selected screen — nothing global. */}
            {showLeft && (
              <>
                <Panel
                  id="left"
                  order={1}
                  defaultSize={advanced ? 20 : 22}
                  minSize={14}
                  maxSize={32}
                  className="border-r border-border bg-card"
                >
                  {advanced ? (
                    <LibraryPanel project={project} />
                  ) : (
                    <Inspector project={project} variant="selection" />
                  )}
                </Panel>
                <ResizeHandle />
              </>
            )}

            <Panel
              id="centre"
              order={2}
              defaultSize={52}
              minSize={30}
              className="relative min-w-0"
            >
              {centre}
            </Panel>

            {ui.rightOpen && (
              <>
                <ResizeHandle />
                <Panel
                  id="right"
                  order={3}
                  defaultSize={26}
                  minSize={18}
                  maxSize={40}
                  className="border-l border-border bg-card"
                >
                  {advanced ? (
                    <PanelGroup direction="vertical">
                      <Panel defaultSize={52} minSize={25}>
                        <Inspector project={project} />
                      </Panel>
                      <ResizeHandle vertical />
                      <Panel defaultSize={48} minSize={25}>
                        <PromptPanel project={project} />
                      </Panel>
                    </PanelGroup>
                  ) : (
                    <PromptPanel project={project} />
                  )}
                </Panel>
              </>
            )}
          </PanelGroup>
        ) : (
          <>
            <main className="min-h-0 flex-1 overflow-hidden">{centre}</main>

            <nav className="flex shrink-0 items-center justify-around border-t border-border bg-card px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
              {advanced && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 flex-col gap-0.5 text-[10px]"
                  onClick={() => setLibraryOpen(true)}
                >
                  <Library />
                  Library
                </Button>
              )}
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
                    <Inspector
                      project={project}
                      variant={advanced ? "full" : "selection"}
                    />
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
