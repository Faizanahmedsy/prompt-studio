"use client"

import { Workflow } from "lucide-react"
import Link from "next/link"


/**
 * The frame every signed-out screen sits in.
 *
 * Deliberately plain. This is the first thing anyone sees, it renders before
 * the workbench has loaded anything, and it must look finished on a phone —
 * so it is one centred card with no panels, no canvas and no store behind it.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/30 px-4 py-10">
      <div className="flex items-center gap-2.5 text-foreground">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Workflow className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Prompt Studio</span>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-5">{children}</div>
      </div>

      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </main>
  )
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
    >
      {children}
    </Link>
  )
}
