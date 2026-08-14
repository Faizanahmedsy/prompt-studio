"use client"

import {
  Code2,
  Command,
  LayoutPanelTop,
  Moon,
  PanelLeft,
  PanelRight,
  Redo2,
  Sun,
  Undo2,
  Workflow,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { ExperienceToggle } from "@/components/layout/experience-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FlowActions } from "@/features/flow-lang/components/flow-actions"
import { Hint, Kbd } from "@/components/ui/misc"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectMenu } from "@/features/projects/components/project-menu"
import { promptTargets } from "@/features/prompt/engine/targets"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCanRedo,
  useCanUndo,
  useProjectStore,
} from "@/stores/use-project-store"
import { cn } from "@/lib/utils"
import { type WorkMode, useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

export function TopBar({ project }: { project: Project }) {
  const ui = useUiStore()
  const advanced = ui.experience === "advanced"
  const update = useProjectStore((s) => s.update)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()

  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 sm:px-3">
      <span className="flex items-center gap-1.5 pl-1 pr-1">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Workflow className="size-3.5" />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          Prompt Studio
        </span>
      </span>

      <ProjectMenu project={project} />

      <Tabs
        value={ui.mode}
        onValueChange={(value) => ui.setMode(value as WorkMode)}
        className="ml-auto sm:ml-2"
      >
        <TabsList>
          <TabsTrigger value="flow">
            <Workflow />
            <span className="hidden sm:inline">Flow</span>
          </TabsTrigger>
          <TabsTrigger value="landing">
            <LayoutPanelTop />
            <span className="hidden sm:inline">Landing</span>
          </TabsTrigger>
          {advanced && (
            <TabsTrigger value="code">
              <Code2 />
              <span className="hidden sm:inline">Code</span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      <div className="ml-auto flex items-center gap-1.5">
        <FlowActions />

        <Separator orientation="vertical" className="mx-0.5 h-6 max-lg:hidden" />

        <ExperienceToggle />

        <Select
          value={project.target}
          onValueChange={(target) =>
            update((doc) => {
              doc.target = target
            })
          }
        >
          <SelectTrigger
            className={cn("hidden h-8 w-40 text-xs", advanced && "lg:flex")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {promptTargets.map((target) => (
              <SelectItem key={target.id} value={target.id}>
                {target.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="hidden items-center sm:flex">
          <Hint label={<span className="flex items-center gap-1">Undo <Kbd>⌘Z</Kbd></span>}>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={!canUndo}
              onClick={undo}
              aria-label="Undo"
            >
              <Undo2 />
            </Button>
          </Hint>
          <Hint label={<span className="flex items-center gap-1">Redo <Kbd>⌘⇧Z</Kbd></span>}>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={!canRedo}
              onClick={redo}
              aria-label="Redo"
            >
              <Redo2 />
            </Button>
          </Hint>
        </span>

        <Hint label={<span className="flex items-center gap-1">Commands <Kbd>⌘K</Kbd></span>}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => ui.setPalette(true)}
            aria-label="Open command palette"
          >
            <Command />
          </Button>
        </Hint>

        <span className="hidden items-center xl:flex">
          {advanced && (
            <Hint label="Toggle library">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={ui.toggleLeft}
                aria-label="Toggle library panel"
                aria-pressed={ui.leftOpen}
              >
                <PanelLeft />
              </Button>
            </Hint>
          )}
          <Hint label="Toggle inspector">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={ui.toggleRight}
              aria-label="Toggle inspector panel"
              aria-pressed={ui.rightOpen}
            >
              <PanelRight />
            </Button>
          </Hint>
        </span>

        <ThemeToggle />
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <Hint label="Toggle theme">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="Toggle colour theme"
      >
        {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
      </Button>
    </Hint>
  )
}
