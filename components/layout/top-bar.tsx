"use client"

import {
  Code2,
  Command,
  Database,
  Globe,
  LayoutPanelTop,
  Moon,
  Palette,
  PanelLeft,
  PanelRight,
  Redo2,
  Server,
  Share2,
  Smartphone,
  Sun,
  Undo2,
  Workflow,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { ExperienceToggle } from "@/components/layout/experience-toggle"
import { Button } from "@/components/ui/button"
import { Hint, Kbd } from "@/components/ui/misc"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountMenu } from "@/features/auth/components/account-menu"
import {
  countsBySurface,
  surfaceMeta,
} from "@/features/builder/utils/surfaces"
import { MembersDialog } from "@/features/cloud/components/members-dialog"
import { PresenceStack, SyncBadge } from "@/features/cloud/components/presence-stack"
import type { CollabMember } from "@/features/collab/use-collaboration"
import { FlowActions } from "@/features/flow-lang/components/flow-actions"
import { ProjectMenu } from "@/features/projects/components/project-menu"
import { promptTargets } from "@/features/prompt/engine/targets"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/use-auth-store"
import {
  useCanRedo,
  useCanUndo,
  useProjectStore,
} from "@/stores/use-project-store"
import { useSyncStore } from "@/stores/use-sync-store"
import { useUiStore, type WorkMode } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

/**
 * How many screens a surface holds. Shown on the tab so an empty Mobile or
 * Backend reads as "nothing here yet" rather than "this is broken".
 */
function SurfaceCount({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
      {count}
    </span>
  )
}

export function TopBar({
  project,
  live,
}: {
  project: Project
  /** The collaboration session for this project, owned by the Workbench. */
  live?: {
    members: CollabMember[]
    status: "idle" | "connecting" | "open" | "reconnecting" | "closed"
    conflict: boolean
    reload: () => void
  }
}) {
  const ui = useUiStore()
  const me = useAuthStore((s) => s.user)
  const remoteId = useSyncStore((s) => s.links[project.id] ?? null)
  const [sharing, setSharing] = useState(false)
  const advanced = ui.experience === "advanced"
  const update = useProjectStore((s) => s.update)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const counts = countsBySurface(project)

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
          <TabsTrigger value="web" title={surfaceMeta.web.hint}>
            <Globe />
            <span className="hidden sm:inline">Web</span>
            <SurfaceCount count={counts.web} />
          </TabsTrigger>
          <TabsTrigger value="mobile" title={surfaceMeta.mobile.hint}>
            <Smartphone />
            <span className="hidden sm:inline">Mobile</span>
            <SurfaceCount count={counts.mobile} />
          </TabsTrigger>
          <TabsTrigger value="landing">
            <LayoutPanelTop />
            <span className="hidden sm:inline">Landing</span>
          </TabsTrigger>
          <TabsTrigger value="backend" title={surfaceMeta.backend.hint}>
            <Server />
            <span className="hidden sm:inline">Backend</span>
            <SurfaceCount count={counts.backend} />
          </TabsTrigger>
          {/*
            The data model is not a build — it is what every build reads and
            writes, which is why it sits beside them rather than inside one.
          */}
          <TabsTrigger
            value="data"
            title="Tables, columns and relations — shared by every build"
          >
            <Database />
            <span className="hidden sm:inline">Data</span>
            <SurfaceCount count={project.entities.length} />
          </TabsTrigger>
          {/*
            Available in Easy too. Reading the Flow source is how you check what
            the diagram actually says, and hiding it behind Advanced made that a
            setting to discover rather than a tab to click.
          */}
          <TabsTrigger
            value="theme"
            title="Colour, type, shape and motion — shared by every build"
          >
            <Palette />
            <span className="hidden sm:inline">Design</span>
          </TabsTrigger>
          <TabsTrigger value="code">
            <Code2 />
            <span className="hidden sm:inline">Code</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="ml-auto flex items-center gap-1.5">
        {live && <PresenceStack members={live.members} youId={me?.id} />}
        {live && (
          <SyncBadge status={live.status} conflict={live.conflict} onReload={live.reload} />
        )}

        <Hint label="Share this project with an email address">
          <Button size="icon-sm" variant="ghost" onClick={() => setSharing(true)} aria-label="Share">
            <Share2 />
          </Button>
        </Hint>
        <MembersDialog
          remoteId={remoteId}
          projectName={project.name}
          open={sharing}
          onOpenChange={setSharing}
        />

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

        {/*
          `lg` rather than `xl`: this is the only way to reclaim the width the
          inspector takes, and on a 1280px laptop it was hidden at exactly the
          size where someone most wants it.
        */}
        <span className="hidden items-center lg:flex">
          {/* The left slot is the library in Advanced and the inspector in
              Easy. Both are worth being able to close, so the toggle is
              offered in both — it was Advanced-only, which left the Easy
              inspector permanently pinned. */}
          <Hint label={advanced ? "Toggle library" : "Toggle screen panel"}>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={ui.toggleLeft}
              aria-label={advanced ? "Toggle library panel" : "Toggle screen panel"}
              aria-pressed={ui.leftOpen}
            >
              <PanelLeft />
            </Button>
          </Hint>
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

        <AccountMenu />
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
