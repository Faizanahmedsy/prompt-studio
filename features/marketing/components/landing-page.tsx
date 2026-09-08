"use client"

/**
 * The front door.
 *
 * `/` was the studio until the prompt library became public; a product whose
 * only public page is a login form has nothing to link to. This is deliberately
 * small — one screen of explanation, two ways in, and a section for the half of
 * the site that needs no account at all.
 *
 * The three steps are numbered because they are genuinely a sequence. Nothing
 * else here is numbered, tiled, or given an icon it did not earn.
 */

import { ArrowRight, Workflow } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PublicHeader } from "@/features/marketing/components/public-header"
import { libraryPrompts } from "@/features/prompt-library/data/prompts"
import { STUDIO_HOME } from "@/lib/view-url"
import { useAuthStore } from "@/stores/use-auth-store"

const STEPS = [
  {
    title: "Draw the flow",
    body: "Screens, the journeys through them, the data behind them, and which builds ship — web, mobile, landing, backend.",
  },
  {
    title: "Choose the design",
    body: "Pick a preset and tune it, or hand the decision to the agent with a brief that tells it how to decide.",
  },
  {
    title: "Copy the prompt",
    body: "One prompt per build, assembled from everything above, ready for Claude Code, Cursor, v0 or anything else.",
  },
]

export function LandingPage() {
  const status = useAuthStore((s) => s.status)
  const signedIn = status === "authed" || status === "offline"

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-5 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Draw the app. Get the prompt that builds it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Prompt Studio turns a diagram of your product — its screens, journeys,
            data model and design — into the long, specific build prompt a coding
            agent needs. Edit the diagram, not the prompt.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={signedIn ? STUDIO_HOME : "/register"}>
                {signedIn ? "Open the studio" : "Start a project"}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/prompts">Browse the prompt library</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            The prompt library is free and needs no account.
          </p>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-16">
            <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
            <ol className="mt-6 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="text-xs font-semibold tabular-nums text-primary">
                    {index + 1}
                  </span>
                  <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-9">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {libraryPrompts.length} prompts you can take right now
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Whole, hand-written prompts for design, building, debugging,
              review and planning — the master design brief among them. Nothing
              to install, no account, no project. Open one, copy it, paste it
              into whatever assistant you already have open.
            </p>
            <Button asChild className="mt-6">
              <Link href="/prompts">
                Open the library
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Workflow className="size-3.5" />
            Prompt Studio
          </span>
          <Link href="/prompts" className="hover:text-foreground">
            Prompt library
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Log in
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Create an account
          </Link>
        </div>
      </footer>
    </div>
  )
}
