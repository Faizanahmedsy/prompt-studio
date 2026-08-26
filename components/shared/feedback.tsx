"use client"

import { AlertTriangle } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary [&_svg]:size-6">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function WarningList({
  warnings,
  className,
}: {
  warnings: string[]
  className?: string
}) {
  if (!warnings.length) return null
  return (
    <ul className={cn("space-y-1.5", className)}>
      {warnings.map((warning) => (
        <li
          key={warning}
          className="flex items-start gap-2 rounded-md bg-warning-soft/60 px-2 py-1.5 text-[11px] leading-snug text-foreground"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />
          <span>{warning}</span>
        </li>
      ))}
    </ul>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  /**
   * Return `false` — or resolve to it — to keep the dialog open.
   *
   * Confirming used to close the dialog unconditionally, which is fine for a
   * local action that cannot fail and wrong for one that talks to a server: a
   * refused delete looked exactly like a successful one until the project
   * reappeared.
   */
  onConfirm: () => void | boolean | Promise<void | boolean>
}) {
  const [working, setWorking] = useState(false)

  const confirm = async () => {
    setWorking(true)
    try {
      const result = await onConfirm()
      if (result !== false) onOpenChange(false)
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={working}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Confirm-before-doing wrapper, so callers don't each hold dialog state. */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    onConfirm: () => void
  }>({ open: false, title: "", onConfirm: () => {} })

  const confirm = (options: {
    title: string
    description?: string
    confirmLabel?: string
    onConfirm: () => void
  }) => setState({ ...options, open: true })

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      onConfirm={state.onConfirm}
    />
  )

  return { confirm, dialog }
}
