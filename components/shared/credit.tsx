"use client"

import { Heart } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/misc"
import { cn } from "@/lib/utils"

/**
 * The people who built it. One entry per person; a `href` is optional, and the
 * name renders as plain text without one rather than as a link to nowhere.
 */
const engineers: { name: string; href?: string }[] = [
  { name: "Faizan", href: "https://faizansaiyed.vercel.app/" },
  { name: "Trusha" },
  { name: "Tejus" },
  { name: "Krishna" },
]

/**
 * The byline, in one place.
 *
 * It used to be written out twice — once in the top bar and once in the auth
 * shell — which is how a credit ends up naming different people on the sign-in
 * page than in the app. Both now render this, so there is one list to edit.
 */
export function Credit({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 text-[11px] text-muted-foreground", className)}>
      Developed with
      <Heart className="size-3 fill-destructive text-destructive" aria-hidden="true" />
      <span className="sr-only">love</span>
      by
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            Super Engineers
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-52 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Super Engineers
          </p>
          <ul className="mt-2 space-y-1.5">
            {engineers.map((engineer) => (
              <li key={engineer.name} className="text-sm leading-none">
                {engineer.href ? (
                  <a
                    href={engineer.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                  >
                    {engineer.name}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">{engineer.name}</span>
                )}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  )
}
