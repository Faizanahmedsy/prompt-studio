"use client"

import { Check, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/feedback"
import { cn } from "@/lib/utils"

import type { LayoutOption } from "../data/layout-types"
import { isMobileLayout, layoutCategories } from "../data/layouts"
import { LayoutThumb } from "./layout-thumb"

export function LayoutPicker({
  open,
  onOpenChange,
  layouts,
  selected,
  onSelect,
  title = "Choose a layout",
  accent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  layouts: LayoutOption[]
  selected?: string
  onSelect: (layoutId: string) => void
  title?: string
  accent?: string
}) {
  const [category, setCategory] = useState("")
  const [query, setQuery] = useState("")
  const [preview, setPreview] = useState<LayoutOption | null>(null)

  const categories = useMemo(() => layoutCategories(layouts), [layouts])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return layouts.filter((layout) => {
      if (category && layout.category !== category) return false
      if (!q) return true
      return `${layout.name} ${layout.description} ${layout.id}`
        .toLowerCase()
        .includes(q)
    })
  }, [layouts, category, query])

  const detail = preview ?? visible.find((l) => l.id === selected) ?? visible[0]

  const choose = (id: string) => {
    onSelect(id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88dvh] w-[min(1100px,calc(100vw-1.5rem))] max-w-none gap-3 p-0 sm:h-[80dvh]">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick the arrangement. The description below is what gets written into
            the generated prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 lg:flex-row">
          {/* Filters */}
          <div className="flex shrink-0 flex-col gap-2 lg:w-44">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search layouts"
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              <FilterChip
                active={category === ""}
                onClick={() => setCategory("")}
                label={`All (${layouts.length})`}
              />
              {categories.map((name) => (
                <FilterChip
                  key={name}
                  active={category === name}
                  onClick={() => setCategory(name)}
                  label={name}
                />
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg">
            {visible.length === 0 ? (
              <EmptyState
                icon={<Search />}
                title="No layouts match"
                description="Try a different search term or clear the category filter."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setQuery("")
                      setCategory("")
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 pr-1 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => choose(layout.id)}
                    onMouseEnter={() => setPreview(layout)}
                    onFocus={() => setPreview(layout)}
                    className="group flex flex-col gap-2 rounded-lg p-1 text-left outline-none"
                  >
                    <LayoutThumb
                      shape={isMobileLayout(layout.id) ? "phone" : "wide"}
                      wire={layout.wire}
                      accent={accent}
                      interactive
                      selected={selected === layout.id}
                    />
                    <span className="flex items-start justify-between gap-1 px-0.5">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">
                          {layout.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {layout.description}
                        </span>
                      </span>
                      {selected === layout.id && (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          {detail && (
            <aside className="hidden w-72 shrink-0 flex-col gap-3 rounded-lg border border-border bg-surface p-3 xl:flex">
              <LayoutThumb
                shape={isMobileLayout(detail.id) ? "phone" : "wide"}
                wire={detail.wire}
                size="lg"
                accent={accent}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{detail.name}</h3>
                  <Badge variant="outline">{detail.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{detail.description}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-card p-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Goes into the prompt as
                </p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  {detail.promptDetails}
                </p>
              </div>
              <Button size="sm" onClick={() => choose(detail.id)}>
                Use this layout
              </Button>
            </aside>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
