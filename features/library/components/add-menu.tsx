"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { Glyph } from "@/components/icons/glyph"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/misc"

export type AddMenuItem = {
  id: string
  name: string
  icon: string
  description: string
}

/**
 * The canvas-side way to add things. In Easy mode the library panel is gone, so
 * this is the only add affordance — it has to be obvious and land in one click.
 */
export function AddMenu({
  items,
  onPick,
  label,
  align = "start",
}: {
  items: AddMenuItem[]
  onPick: (id: string) => void
  label: string
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" className="h-9 gap-2 px-3 font-semibold shadow-sm">
          <Plus className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onPick(item.id)
                setOpen(false)
              }}
              className="flex items-start gap-2 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Glyph name={item.icon} className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">
                  {item.name}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
