"use client"

import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"
import type * as React from "react"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export const Command = CommandPrimitive
export const CommandList = CommandPrimitive.List
export const CommandGroup = CommandPrimitive.Group
export const CommandSeparator = CommandPrimitive.Separator

export function CommandDialog({
  open,
  onOpenChange,
  children,
  label = "Command palette",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  label?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="top-[12%] max-w-xl translate-y-0 gap-0 p-0"
      >
        <CommandPrimitive
          label={label}
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {children}
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}

export function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        className={cn(
          "flex h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    </div>
  )
}

export function CommandEmpty(
  props: React.ComponentProps<typeof CommandPrimitive.Empty>
) {
  return (
    <CommandPrimitive.Empty
      className="py-8 text-center text-sm text-muted-foreground"
      {...props}
    />
  )
}

export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none",
        "data-[selected=true]:bg-muted data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

export function CommandScroll({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-[60vh] overflow-y-auto overscroll-contain p-1.5", className)}
      {...props}
    />
  )
}
