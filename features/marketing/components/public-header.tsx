"use client"

/**
 * The header on the two pages that do not require an account.
 *
 * Its right-hand action is the whole reason it is a client component: a
 * visitor gets "Log in", and somebody already signed in gets "Open studio",
 * because sending a returning user to a login form they do not need is the
 * most annoying thing a landing page can do. `bootstrap()` runs in Providers
 * on every page, so the status is available here without asking for it.
 */

import { Workflow } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { STUDIO_HOME } from "@/lib/view-url"
import { useAuthStore } from "@/stores/use-auth-store"

export function PublicHeader({ current }: { current?: "prompts" }) {
  const status = useAuthStore((s) => s.status)
  const signedIn = status === "authed" || status === "offline"

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Workflow className="size-3.5" />
          </span>
          Prompt Studio
        </Link>

        <nav className="ml-4 flex items-center gap-1 text-sm">
          <Link
            href="/prompts"
            className={cn(
              "rounded-md px-2 py-1 transition-colors",
              current === "prompts"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Prompt library
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Rendered only once the session is resolved. A button that says
              "Log in" for a moment and then "Open studio" is worse than a
              button that arrives a moment late. */}
          {status === "loading" ? (
            <span className="h-9 w-24" />
          ) : signedIn ? (
            <Button asChild size="sm">
              <Link href={STUDIO_HOME}>Open studio</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
