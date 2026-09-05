"use client"

import { useTheme } from "next-themes"
import { useEffect, useId, useRef, useState } from "react"

/**
 * A ```mermaid fence, drawn.
 *
 * Mermaid is ~500kB and touches `document` at import time, so it is loaded with
 * a dynamic `import()` inside the effect: nothing reaches the server bundle,
 * and nobody who never opens a diagram downloads it.
 *
 * If it cannot parse the source we show the source. A diagram is a
 * hand-editable artifact here — somebody wrote that `.mmd` file and is about to
 * fix it — and an error message with the text hidden is the one outcome that
 * helps nobody.
 */
export function MermaidBlock({ code }: { code: string }) {
  const host = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)
  // `useId` gives a stable, unique element id per instance. Mermaid uses it for
  // the ids inside the SVG, and two diagrams sharing one would cross-wire their
  // markers and arrowheads.
  const id = `mermaid-${useId().replace(/:/g, "")}`

  useEffect(() => {
    let live = true
    setError(null)

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          // Sanitises the rendered output and refuses click/callback directives
          // in the source. Everything below depends on it.
          securityLevel: "strict",
          // Labels as SVG <text> rather than embedded HTML — with htmlLabels on,
          // strict mode still has to scrub a foreignObject full of markup.
          htmlLabels: false,
          theme: resolvedTheme === "dark" ? "dark" : "default",
          fontFamily: "inherit",
        })
        const { svg } = await mermaid.render(id, code)
        if (!live || !host.current) return
        // The only innerHTML in the app, and the reason it is safe: mermaid
        // rendered this string itself in `securityLevel: "strict"`, which
        // sanitises its own output and drops script and event handlers; the
        // input is an artifact written in the editor, not user-submitted HTML;
        // and there is no other way to insert an SVG built outside React.
        host.current.innerHTML = svg
      } catch (failure) {
        if (!live) return
        setError(failure instanceof Error ? failure.message : "Could not draw this diagram")
      }
    })()

    return () => {
      live = false
    }
  }, [code, id, resolvedTheme])

  if (error) {
    return (
      <div className="my-3">
        <p className="mb-1 text-[11px] text-destructive">{error}</p>
        <pre className="code-surface overflow-x-auto text-[11.5px] leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  // The wrapper scrolls, not the page: a wide flowchart must never make the
  // whole document scroll sideways.
  return (
    <div className="my-3 overflow-x-auto break-inside-avoid rounded-lg border border-border bg-card p-3">
      <div ref={host} className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" />
    </div>
  )
}
