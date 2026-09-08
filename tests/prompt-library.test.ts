import { describe, expect, it } from "vitest"

import {
  libraryPrompts,
  promptById,
  promptCategories,
  searchPrompts,
} from "@/features/prompt-library/data/prompts"
import { modeFromSlug, STUDIO_HOME, VIEW_SLUGS } from "@/lib/view-url"

/**
 * The library ships prompts, not components — so the tests that matter are
 * about the text. A prompt with a placeholder nobody filled in, or a body
 * short enough to be a summary of a prompt rather than a prompt, is the
 * failure this file exists to catch.
 */
describe("the library holds usable prompts", () => {
  it("lives on a public route, not on a studio tab", () => {
    // The library needs no account and no project, so /prompts is a page of
    // its own rather than a mode of the workbench. If it were a studio slug
    // the catch-all would claim the path and put it back behind the login.
    expect(modeFromSlug("prompts")).toBeNull()
    expect(Object.values(VIEW_SLUGS)).not.toContain("prompts")
    expect(STUDIO_HOME).toBe("/web")
  })

  it("gives every prompt a unique id", () => {
    const ids = libraryPrompts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(promptById.size).toBe(libraryPrompts.length)
  })

  it("only uses categories the filter offers", () => {
    for (const prompt of libraryPrompts) {
      expect(promptCategories).toContain(prompt.category)
    }
  })

  it("fills every category", () => {
    for (const category of promptCategories) {
      expect(
        libraryPrompts.some((p) => p.category === category),
        `no prompt in ${category}`
      ).toBe(true)
    }
  })

  it.each(libraryPrompts.map((p) => [p.id, p] as const))(
    "%s is a whole prompt, not a summary",
    (_id, prompt) => {
      expect(prompt.title.length).toBeGreaterThan(3)
      expect(prompt.blurb.length).toBeGreaterThan(20)
      expect(prompt.howToUse.length).toBeGreaterThan(20)
      expect(prompt.tags.length).toBeGreaterThan(2)
      expect(prompt.body.length).toBeGreaterThan(600)
      // Every tag is lowercase, so search never misses on case.
      for (const tag of prompt.tags) expect(tag).toBe(tag.toLowerCase())
    }
  )

  it("marks the slot the reader has to fill in", () => {
    for (const prompt of libraryPrompts) {
      expect(
        /^\[.+\]$/m.test(prompt.body),
        `${prompt.id} has no bracketed slot on its own line`
      ).toBe(true)
    }
  })

  it("leaves no unbalanced bold markers", () => {
    for (const prompt of libraryPrompts) {
      const marks = prompt.body.match(/\*\*/g)?.length ?? 0
      expect(marks % 2, `${prompt.id} has an unclosed **`).toBe(0)
    }
  })
})

describe("the master design prompt", () => {
  const master = promptById.get("master-design")
  const body = master?.body ?? ""

  it("is the first thing in the library", () => {
    expect(libraryPrompts[0].id).toBe("master-design")
  })

  it("replaced the three single-look prompts rather than joining them", () => {
    for (const gone of ["instrument-ui", "dark-console", "light-saas"]) {
      expect(promptById.has(gone), `${gone} should be gone`).toBe(false)
    }
    expect(libraryPrompts.filter((p) => p.category === "Design")).toHaveLength(3)
  })

  it("opens with the ten rules that have actually broken, before anything else", () => {
    const summary = body.indexOf("# IF YOU READ NOTHING ELSE")
    expect(summary).toBeGreaterThan(-1)
    expect(summary).toBeLessThan(body.indexOf("# PART 0"))
  })

  it("puts the parts in dependency order", () => {
    const order = [
      "# PART 0 — READ THE PROJECT",
      "# PART 1 — THE STACK",
      "# PART 2 — THE SYSTEM",
      "# PART 3 — THE NINE DIRECTIONS",
      "# PART 4 — COMPONENTS",
      "# PART 5 — ILLUSTRATION",
      "# PART 6 — NEVER SHIP THESE",
      "# PART 7 — AUDIT, THEN FILL THE RECORD",
      "# THE PRODUCT",
    ]
    const positions = order.map((heading) => body.indexOf(heading))
    for (const [i, pos] of positions.entries()) {
      expect(pos, `${order[i]} is missing`).toBeGreaterThan(-1)
      if (i > 0) expect(pos).toBeGreaterThan(positions[i - 1])
    }
  })
})

describe("part 0 — the person, not the domain", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it("makes the model write the scene before anything else", () => {
    // Three products in a row were built as costumes for their subject. The
    // scene is a paragraph about a person in a moment, and it comes first.
    expect(body).toMatch(/## 0\.1 The scene — write this paragraph before anything else/)
    expect(body).toMatch(/Alex is in the driver's seat/)
    expect(body).toMatch(/You cannot write that paragraph and then put a satellite count in the header/)
  })

  it("separates a technical subject from a technical audience", () => {
    expect(body).toMatch(/The subject being technical does not make the audience technical/)
    expect(body).toMatch(/A van driver, a nurse, a teacher/)
  })

  it("asks what device and in what conditions", () => {
    expect(body).toMatch(/\*\*What device, what conditions\?\*\*/)
    expect(body).toMatch(/phone in one hand/)
    expect(body).toMatch(/a twenty-second glance/)
  })

  it("emits the decision as a comment block, so it survives products with no chat", () => {
    // AI Studio, v0 and Lovable swallow prose. An instruction with no visible
    // output is one that can be skipped for free.
    expect(body).toMatch(/Put it in a comment block at the very top of the primary file/)
    expect(body).toMatch(/===== DESIGN DECISION RECORD =====/)
    for (const line of ["SCENE:", "HOLDS:", "REGISTER:", "AVOIDING:", "DIRECTION:", "BECAUSE:", "STACK:", "ACCENT:", "SCALE:", "AUDIT:", "MEMORABLE:"]) {
      expect(body, `${line} missing from the record`).toContain(line)
    }
    expect(body).toMatch(/A line you cannot fill is a decision you have not made/)
  })

  it("forbids blending two directions", () => {
    expect(body).toMatch(/Do not blend two/)
  })
})

describe("part 1 — the stack and the controls that must never be native", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it("names shadcn and Tailwind as the reference tier, with two fallbacks", () => {
    expect(body).toMatch(/\*\*Tier 1 — React, packages installable\.\*\* Tailwind v4, shadcn\/ui on Radix/)
    expect(body).toMatch(/\*\*Tier 2 — React, no install step\.\*\*/)
    expect(body).toMatch(/\*\*Tier 3 — plain HTML and CSS\.\*\*/)
    expect(body).toMatch(/Never fall back to a native control because the library was inconvenient/)
  })

  it("specifies the controls so tiers 2 and 3 can obey the ban", () => {
    for (const control of ["**Select.**", "**Date and time.**", "**Tabs.**", "**Dialog.**", "**Sheet.**", "**Toast.**", "**Focus.**"]) {
      expect(body, `${control} spec missing`).toContain(control)
    }
    expect(body).toMatch(/never "2026-03-14" for a person/)
    expect(body).toMatch(/:focus-visible/)
  })

  it("names keyless map libraries and designs the no-key state", () => {
    // The field-technician build shipped a map tiled with "API KEY REQUIRED".
    expect(body).toMatch(/MapLibre GL with the OpenFreeMap or Protomaps demo style, or Leaflet with OpenStreetMap raster tiles/)
    expect(body).toMatch(/not a tiled watermark/)
    expect(body).toMatch(/A basemap tiled with "API KEY REQUIRED" is a failed build/)
  })
})

describe("part 2 — a system with numbers, read out of the products people chose", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it("names three surfaces in a fixed order", () => {
    expect(body).toMatch(/\*\*chrome\*\* .*below \*\*page\*\* .*below \*\*card\*\*/)
    expect(body).toMatch(/the rail is the lowest surface/)
  })

  it("carries the inset content frame — the move that makes it a product", () => {
    expect(body).toMatch(/The content area is an \*\*inset frame\*\*/)
    expect(body).toMatch(/"a website with a sidebar" and "a product"/)
  })

  it("states the dark ramp with its four rules and real values", () => {
    expect(body).toMatch(/Chroma is zero\. Not nearly zero\./)
    expect(body).toMatch(/Border-led, not value-led/)
    expect(body).toMatch(/The warmth lives in the text/)
    expect(body).toContain("oklch(0.281 0 0)")
    expect(body).toContain("oklch(0.709 0 0)")
  })

  it("has the colour rules: triad, gamut, split fill, soft semantic, categorical for identity", () => {
    expect(body).toMatch(/The brand is a triad/)
    expect(body).toMatch(/Check the gamut/)
    expect(body).toMatch(/Split the fill from the accent when contrast demands it/)
    expect(body).toMatch(/\*\*Soft by default\.\*\*/)
    expect(body).toMatch(/At most one solid semantic fill visible per row/)
    expect(body).toMatch(/Categorical colour is for identity, not emphasis/)
    expect(body).toMatch(/under five percent of the pixels/)
  })

  it("puts a 13px floor and a pixel scale on type", () => {
    expect(body).toMatch(/\*\*The floor is 13px\.\*\*/)
    expect(body).toMatch(/no `text-\[10px\]`, no `text-\[11px\]`/)
    expect(body).toMatch(/36–56 {2}h1 — weight 900/)
    expect(body).toMatch(/Sizes come off the scale, never a bracket literal/)
    expect(body).toMatch(/Sentence case is the house style/)
    expect(body).toMatch(/tabular-nums/)
  })

  it("keeps monospace off by default with the cap, the never-list and the history", () => {
    expect(body).toMatch(/\*\*Monospace is off by default\.\*\*/)
    expect(body).toMatch(/for at most two roles/)
    expect(body).toMatch(/five percent of the visible words/)
    for (const banned of ["Never body", "navigation", "buttons", "form labels", "card titles", "stat labels", "mottos", "people's names"]) {
      expect(body, `${banned} should be on the never list`).toContain(banned)
    }
    expect(body).toMatch(/A previous version of this brief called monospace/)
  })

  it("owns spacing at the stack, with one number", () => {
    expect(body).toMatch(/A stack owns the space between its children\. A child never owns the space around itself\./)
    expect(body).toMatch(/\*\*One card recipe\.\*\*/)
    expect(body).toMatch(/\[&>\*\]:min-w-0/)
    expect(body).toMatch(/Chrome budget: at most three horizontal bands before the content/)
  })

  it("derives every radius from one token and keeps buttons flat", () => {
    expect(body).toMatch(/`--radius: 10px`/)
    expect(body).toMatch(/--radius-field/)
    expect(body).toMatch(/\*\*Buttons are flat\.\*\*/)
    expect(body).toMatch(/scale\(0\.96\)/)
    expect(body).toMatch(/\*\*Dark mode: none\.\*\*/)
  })

  it("makes a figure earn its place", () => {
    // "Every figure carries its unit" manufactured satellite counts.
    expect(body).toMatch(/only if the person would do something differently because of it/)
    expect(body).toMatch(/A satellite count, an uptime percentage, a vehicle's model name/)
  })

  it("asks for the reason beside every non-obvious choice", () => {
    expect(body).toMatch(/## 2\.11 Write the reason/)
    expect(body).toMatch(/tell a decision from an accident/)
  })
})

describe("part 3 — nine directions, each with a way out", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it.each([
    "EDITORIAL INSTITUTIONAL",
    "LIGHT PRODUCT",
    "TECHNICAL CONSOLE",
    "OPERATIONAL DENSE",
    "WARM CONSUMER",
    "QUIET LUXURY",
    "UTILITY BRUTAL",
    "EXPRESSIVE APP",
    "REFINED OPERATIONAL",
  ])("offers %s", (name) => {
    expect(body).toContain(`— ${name}`)
  })

  it("gives every direction a choose-when, a never-when and a fail mode", () => {
    const count = (re: RegExp) => body.match(re)?.length ?? 0
    expect(count(/\*\*Choose when/g)).toBe(9)
    expect(count(/\*\*Never choose when/g)).toBe(9)
    expect(count(/\*\*Fail mode\.\*\*/g)).toBe(9)
  })

  it("routes institutions away from the console and the console away from non-technical people", () => {
    expect(body).toMatch(/An institution does not report its own vital signs to visitors/)
    expect(body).toMatch(/A GPS-tracking product for van drivers is not a developer tool/)
    expect(body).toMatch(/impersonating one/)
  })

  it("rebuilt Direction D with a positive brief and a new fail mode", () => {
    const d = body.slice(body.indexOf("## DIRECTION D"), body.indexOf("## DIRECTION E"))
    expect(d).toMatch(/page header card/)
    expect(d).toMatch(/Density is a spacing choice; it is not permission to skip the system/)
    expect(d).toMatch(/choose Direction I/)
  })

  it("adds Direction I for the product that is daily and branded", () => {
    const i = body.slice(body.indexOf("## DIRECTION I"))
    expect(i).toMatch(/Bootstrap admin panel/)
    expect(i).toMatch(/mission control/)
    expect(i).toMatch(/The frame is the signature of this direction/)
    expect(i).toMatch(/\*\*No monospace\.\*\*/)
    expect(i).toMatch(/the canvas is the page and everything else is a card over it/)
    expect(i).toMatch(/Overlays take the \*page's\* ground, never the opposite/)
    expect(i).toMatch(/A section that failed to load and a section with nothing in it must never look the same/)
  })

  it("carries the KPI tile anatomy, delta beside not under", () => {
    expect(body).toMatch(/delta pill baseline-beside it/)
    expect(body).toMatch(/The exact figure small underneath/)
  })
})

describe("parts 4–7 — components, illustration, never-list, audit", () => {
  const body = promptById.get("master-design")?.body ?? ""

  it("specifies maps as a component, since that is where the last build failed", () => {
    const maps = body.slice(body.indexOf("**Maps.** Per Part 1.3"))
    expect(maps).toMatch(/the person's initial or avatar in a tone, the self-marker distinct/)
    expect(maps).toMatch(/Clustering past ~50 markers/)
    expect(maps).toMatch(/Labels declutter/)
    expect(maps).toMatch(/glides on plausible moves and snaps on implausible ones/)
    expect(maps).toMatch(/one floating group, top-right, three buttons at most/)
  })

  it("keeps the soft-3D illustration language and its per-direction routing", () => {
    expect(body).toMatch(/inline SVG in the codebase/i)
    expect(body).toMatch(/color-mix\(in oklch/)
    expect(body).toMatch(/Ids are namespaced/)
    expect(body).toMatch(/silently steal each other's gradients/)
    for (const move of [/contact shadow/i, /light from the top-left/i, /one gloss/, /generous radii/i]) {
      expect(body).toMatch(move)
    }
    expect(body).toMatch(/"Waiting for approval"`, never `"Clipboard with clock"`/)
    expect(body).toMatch(/Illustration is not universal/)
    expect(body).toMatch(/Full soft-3D: \*\*B, E, H, I\.\*\*/)
    expect(body).toMatch(/None: \*\*F, G\.\*\*/)
  })

  it("has a forty-item never-list that starts with the things that actually shipped", () => {
    expect(body).toMatch(/^1\. A native `<select>`/m)
    expect(body).toMatch(/^3\. A basemap tiled with "API KEY REQUIRED"/m)
    expect(body).toMatch(/^5\. A readout that changes nothing the person does/m)
    expect(body).toMatch(/^40\. /m)
    expect(body).not.toMatch(/^41\. /m)
  })

  it("audits by counting, then fills the record, and hunts for dullness", () => {
    expect(body).toMatch(/\*\*Native controls\.\*\* Count them\. The number is zero\./)
    expect(body).toMatch(/\*\*Chrome\.\*\* Count the horizontal bands/)
    expect(body).toMatch(/\*\*Figures\.\*\* For each number on the screen: what would the person do differently/)
    expect(body).toMatch(/\*\*Dullness\.\*\* Name the one memorable thing/)
    expect(body).toMatch(/\*\*Reasons\.\*\* Does every non-obvious choice have a comment/)
    expect(body).toMatch(/Then the completed record/)
  })

  it("says so in the critique prompt too", () => {
    const critique = promptById.get("design-critique")?.body ?? ""
    expect(critique).toMatch(/Monospace\./)
    expect(critique).toMatch(/Register\./)
  })
})

describe("search", () => {
  it("finds a prompt by a word in its body, not only its title", () => {
    const hits = searchPrompts(libraryPrompts, "sparkline")
    expect(hits.length).toBeGreaterThan(0)
  })

  it("requires every word, so two words narrow rather than widen", () => {
    const one = searchPrompts(libraryPrompts, "design")
    const two = searchPrompts(libraryPrompts, "design terminal")
    expect(two.length).toBeLessThan(one.length)
  })

  it("ignores case and surrounding space", () => {
    expect(searchPrompts(libraryPrompts, "  ROOT Cause ")).toHaveLength(
      searchPrompts(libraryPrompts, "root cause").length
    )
  })

  it("returns everything for an empty query", () => {
    expect(searchPrompts(libraryPrompts, "   ")).toHaveLength(
      libraryPrompts.length
    )
  })

  it("returns nothing rather than everything for a miss", () => {
    expect(searchPrompts(libraryPrompts, "zzzzqqq")).toHaveLength(0)
  })
})
