"use client"

import { cn } from "@/lib/utils"

export function PanelHeader({
  title,
  count,
  actions,
  className,
}: {
  title: string
  count?: number | string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  )
}

/** A scrolling panel body with consistent padding. */
export function PanelBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-3", className)}
      {...props}
    />
  )
}
