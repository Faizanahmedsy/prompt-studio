"use client"

import { MousePointerSquareDashed } from "lucide-react"

import { EmptyState } from "@/components/shared/feedback"
import { PanelBody, PanelHeader } from "@/components/shared/layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FlowInspector } from "@/features/builder/components/flow-inspector"
import { ModuleInspector } from "@/features/builder/components/module-inspector"
import { ScreenInspector } from "@/features/builder/components/screen-inspector"
import { SectionInspector } from "@/features/landing/components/section-inspector"
import { RequirementsPanel } from "@/features/prompt/components/requirements-panel"
import { StackPanel } from "@/features/stack/components/stack-panel"
import { ThemeEditor } from "@/features/theme/components/theme-editor"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

export function Inspector({
  project,
  variant = "full",
}: {
  project: Project
  /** "selection" drops the global tabs — Easy mode shows those in a floating bar */
  variant?: "full" | "selection"
}) {
  const selectedId = useUiStore((s) => s.selectedId)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const screen = project.screens.find((s) => s.id === selectedId)
  const module = project.modules.find((m) => m.id === selectedId)
  const section = project.sections.find((s) => s.id === selectedId)
  const flow = project.flows.find((f) => f.id === selectedId)

  const selection = screen ? (
    <ScreenInspector project={project} screen={screen} />
  ) : flow ? (
    <FlowInspector project={project} flow={flow} />
  ) : module ? (
    <ModuleInspector project={project} module={module} />
  ) : section ? (
    <SectionInspector project={project} section={section} />
  ) : (
    <EmptyState
      icon={<MousePointerSquareDashed />}
      title="Nothing selected"
      description="Pick a screen on the canvas or a section in the page preview to edit it here."
    />
  )

  if (variant === "selection") {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          title={
            section
              ? "Section"
              : flow
                ? "Journey"
                : module
                  ? "Module"
                  : "Screen"
          }
        />
        <PanelBody>{selection}</PanelBody>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Inspector" />
      <Tabs defaultValue="selection" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-3 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="selection">Selection</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            {advanced && <TabsTrigger value="stack">Stack</TabsTrigger>}
            <TabsTrigger value="brief">Brief</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="selection" className="min-h-0">
          <PanelBody>{selection}</PanelBody>
        </TabsContent>

        <TabsContent value="design" className="min-h-0">
          <PanelBody>
            <ThemeEditor project={project} />
          </PanelBody>
        </TabsContent>

        {advanced && (
          <TabsContent value="stack" className="min-h-0">
            <PanelBody>
              <StackPanel project={project} />
            </PanelBody>
          </TabsContent>
        )}

        <TabsContent value="brief" className="min-h-0">
          <PanelBody>
            <RequirementsPanel project={project} />
          </PanelBody>
        </TabsContent>
      </Tabs>
    </div>
  )
}
