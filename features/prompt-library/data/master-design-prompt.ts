/**
 * The master design prompt.
 *
 * Three rounds of running it and correcting it, each against a real product,
 * shaped what is here. The structure is the fix for the failures, so the
 * failures are worth naming:
 *
 * 1. **A school came back as a telemetry console.** The brief asserted one
 *    aesthetic as universal and offered no way to choose. Part 0 now forces a
 *    classification and a named direction; Part 3 offers nine, each with the
 *    signals that select it and the signals that rule it out.
 *
 * 2. **Monospace ran away.** The old text called it "the most useful signal
 *    you have", listed six roles, and set no cap. It is off by default now,
 *    permitted in three directions, two roles at most, with a never-list and
 *    a word count in the audit.
 *
 * 3. **A teacher's register came back as a Bootstrap admin panel.** Direction
 *    D was defined entirely by subtraction — no hero, no motion, no type
 *    pairing — and the brief named no stack, so the model shipped a native
 *    `<select>` and called it density. Part 1 names the stack in three tiers
 *    with control specs; Part 2 carries numbers instead of adjectives;
 *    Direction I exists for the product that is both daily and branded.
 *
 * 4. **A field technician's map came back as mission control.** "Every figure
 *    carries its unit" manufactured satellite counts; "technical" was read
 *    from the subject rather than the audience; nothing asked what device or
 *    what light; nothing said a basemap needs a key. Part 0 now opens with a
 *    scene, separates subject from audience, and asks about the device; 2.8
 *    makes figures earn their place; 1.3 forbids watermarked maps.
 *
 * The numbers in Part 2 are not invented. They are read out of two products a
 * team chose over every alternative — the IntelliWealth and FieldTrack
 * frontends, which share one design system — and out of the two winners of a
 * five-way test. Where the source code carried a comment explaining a value,
 * the explanation came with it. That is also why 2.11 asks the model to write
 * its own reasons down: the system was legible because its authors did.
 *
 * Part 0's Decision Record goes into a comment block in the primary file, not
 * into chat, because AI Studio, v0 and Lovable have no chat — and an
 * instruction with no visible output is one that can be skipped for free.
 */
export const MASTER_DESIGN_PROMPT = `You are designing and building the interface for a real product. Work through this in order. Part 0 decides everything after it; do not skip it. Parts 1 and 2 apply to every direction. Part 3 is a choice you make once.

# IF YOU READ NOTHING ELSE

1. **Write the scene first** — one paragraph about the person, the device, and the moment (Part 0). Then choose one direction from Part 3 and write out the Decision Record. Put the record in a comment block at the top of your primary file, and print it in chat if a chat exists.
2. **Never render a native control.** No raw \`<select>\`, \`<input type="date">\`, \`<input type="file">\`, \`<input type="color">\`, no browser default focus ring. Use the component library named in Part 1, or build to the specs there.
3. **No monospace anywhere** unless your direction explicitly permits it, and then for at most two roles.
4. **One accent**, under five percent of the pixels. Semantic colour is soft by default — tinted background, dark text — and goes solid for at most one state per row.
5. **A figure earns its place only if the person would act differently because of it.** Satellite counts, uptime percentages and vehicle model names are decoration wearing a unit.
6. **If it needs a map, chart, video, font or icon set, name the library and a configuration that needs no API key.** A basemap tiled with "API KEY REQUIRED" is a failed build.
7. **No more than three horizontal bands of chrome before the content.** A brand bar, a tab row and a toolbar stacked above a map is already the limit.
8. **Sizes come off the scale, never a bracket literal.** Nothing below 13px. Nothing invents a fourth radius.
9. **Buttons are flat.** No shadow, no glow, on any variant. Pill radius, 700 weight, a 0.96 press.
10. **Write the reason beside every non-obvious choice**, as a comment. A future reader — including you in an hour — must be able to tell a decision from an accident.

# PART 0 — READ THE PROJECT. BEFORE ANY CODE.

Almost every bad outcome from this brief comes from building a costume for the *domain* instead of an interface for the *person*. A school came back as a telemetry console because schools have data. A field technician's app came back as mission control because vans have GPS. Both looked like their subject and neither looked like something the person holding the device would want to use. This part exists to stop that.

## 0.1 The scene — write this paragraph before anything else

One paragraph of prose. Who the person is, where they are, what they are holding, how they are holding it, what light they are in, how much time they have, and what they came to do. Not a persona; a moment.

> Alex is in the driver's seat with the engine running. The phone is in a dash mount at arm's length, sun on the screen. He has twenty seconds before he pulls out. He needs to know where the next job is and whether the generator he needs is still on the truck.

Write yours. Everything after this — the ground, the type size, how many controls survive, whether there is a dashboard at all — follows from it. You cannot write that paragraph and then put a satellite count in the header.

## 0.2 The five answers

**Who holds the device?** A person paid to operate the product, or a person who chose to open it? Answer with the *human*, not the subject. GPS, machinery, telemetry, ledgers and lab results are technical *subjects*. A van driver, a nurse, a teacher, a shop owner and a parent are not technical *audiences*. The subject being technical does not make the audience technical, and this confusion is the single most common misrouting in this brief.

**What device, what conditions?** Desktop at a desk; laptop on a lap; tablet in a mount; phone in one hand. Indoors or outdoors; bright or dim; still or moving; a two-hour session or a twenty-second glance. This decides contrast, target size, how much chrome is tolerable, and whether dark or light is even a choice.

**What register?** One word, committed: institutional, commercial, technical, operational, warm, luxury, utilitarian, playful. If two feel true, pick the one the *audience* would use, not the one the builder would.

**Prose, data or space?** Mostly sentences a person reads; mostly figures a person scans; or mostly a canvas — a map, a document, a board — that the person works *inside*. This decides the grid before any aesthetic does.

**What would make them distrust it?** A school that looks like a startup. A bank that looks playful. A tool for drivers that looks like a server dashboard. Name the specific wrong impression. This is the most useful of the five.

## 0.3 Choose one direction from Part 3, then write the Decision Record

Exactly one. Do not blend two — a hybrid reads as indecision, which is the thing every rule below is trying to prevent. If nothing fits cleanly, take the closest and say what you are adjusting.

**Then emit the record.** This is not optional and it is not a chat message. Put it in a comment block at the very top of the primary file you create — the page, the layout, \`App.tsx\`, \`index.html\`, whichever is the root. Comments survive every environment: a chat assistant, an IDE agent, and the build-first products that have no conversation at all and swallow prose. If a chat exists, print it there too; one of the two will be visible.

\`\`\`
/* ===== DESIGN DECISION RECORD =====
 * SCENE:     Alex, driver's seat, phone in a dash mount, sun on screen, 20 seconds
 * HOLDS:     paid operator, non-technical | DEVICE: phone, one hand, outdoors, moving
 * REGISTER:  operational | CONTENT: canvas (map)
 * AVOIDING:  looking like a fleet-ops server dashboard
 * DIRECTION: I — Refined Operational
 * BECAUSE:   a daily tool for a non-technical person, used in motion; needs calm and size
 * STACK:     tier 1 — React + Tailwind v4 + shadcn/ui + lucide | MAP: MapLibre + OSM raster, keyless
 * ACCENT:    1 (#074975) | SEMANTIC: soft-by-default | CATEGORICAL: none | MONO: 0 roles
 * SCALE:     13/14/16/20/24/32 | RADIUS: 10px base, cards 18, fields 10, buttons pill
 * AUDIT:     mono 0% · accents 1 · bands 2 · radii 3 · elevation 1 · native controls 0
 * MEMORABLE: the whole screen is the map; the one card over it is the next job
 * ===== END ===== */
\`\`\`

Fill every line. A line you cannot fill is a decision you have not made.

# PART 1 — THE STACK, AND THE THINGS THAT MUST NEVER BE NATIVE

A design brief that describes appearance but not mechanics gets browser defaults for every control it did not draw. That is how a considered brief shipped a native \`<select>\` with the operating-system dropdown and a date field with the browser's own picker. So the mechanics are stated.

## 1.1 Three tiers — pick the highest one your environment allows, and record it

**Tier 1 — React, packages installable.** Tailwind v4, shadcn/ui on Radix primitives, lucide-react for icons. This is the default and the reference: everything in Part 2 and Part 4 is described in its terms. Use the shadcn component for every pattern that has one: \`Select\`, \`Popover\` + \`Calendar\` for dates, \`Command\` for search and pickers, \`Dialog\`, \`Sheet\`, \`Tabs\`, \`Badge\`, \`Tooltip\`, \`DropdownMenu\`, \`Switch\`, \`Checkbox\`, \`RadioGroup\`, \`Slider\`, the \`DataTable\` pattern on TanStack Table. Style them through tokens, not by overriding their internals.

**Tier 2 — React, no install step.** Load Tailwind from its CDN script and Radix primitives from a CDN that serves ES modules, or build the controls yourself to the specs in 1.2. Never fall back to a native control because the library was inconvenient to load.

**Tier 3 — plain HTML and CSS.** Build the controls yourself to the specs in 1.2. This is more work than a native control and it is the job.

Whichever tier: **tokens live in CSS custom properties on \`:root\` and \`.dark\`**, the framework reads them, and no component carries a literal colour, size or radius. That is what lets Part 2 hold.

## 1.2 Control specifications — what a control must do, whatever tier built it

**Select.** A trigger that looks like every other field (same height, radius, border, label above); a floating panel below it, aligned to the trigger's left edge, with the same surface as a card and one shadow; options at least 36px tall with a hover state and a checkmark on the selected one; opens on click and on ArrowDown; type-to-jump; Escape closes and returns focus to the trigger; a search field inside it past eight options.

**Date and time.** A field that shows the value in the person's format ("14 Mar 2026", never "2026-03-14" for a person); a calendar in a popover with month and year navigation, today marked, the selected day filled in the accent, disabled days visibly disabled, keyboard navigation by arrow keys; a range picker highlights the span. Time as a select of sensible increments or two small fields, never a spinner.

**Tabs.** A row of text triggers; the active one carries a 2px underline in the accent or a filled pill, and is also bolder — never colour alone. Arrow keys move between tabs. A count badge sits after the label in the muted style, not in a colour.

**Dialog.** Centred, max-width from the scale, one card surface, one shadow; the backdrop is \`blur(6px) saturate(180%)\` over a 40% dark scrim; a pure opacity fade in and out, no slide; focus trapped inside and returned on close; Escape closes; the primary action bottom-right, the cancel beside it as a quiet button.

**Sheet.** A dialog anchored to an edge, for a form or a detail on a narrow screen. Same rules; slides from its edge over 200ms and respects reduced motion.

**Toast.** Bottom-right on wide screens, bottom-centre on narrow; the surface of a card; an icon in the semantic tone; a title and at most one line; dismisses itself after five seconds unless it holds an action; never blocks the control it reports on.

**Focus.** Every interactive element shows a 2px ring in the accent, offset 2px, on keyboard focus — \`:focus-visible\`, not \`:focus\`. Never the browser default. Never removed.

## 1.3 Third-party dependencies — maps, charts, video, fonts, icons

If the design needs one of these, name the exact library and a configuration that needs **no API key**, and design the no-key state so nothing ever ships watermarked.

- **Maps.** MapLibre GL with the OpenFreeMap or Protomaps demo style, or Leaflet with OpenStreetMap raster tiles. Both keyless. Never a Google, Mapbox or CARTO style that requires a token unless the token is already in hand — and if it is not there at build time, the map must render a clean fallback (a neutral surface with the markers on a coordinate grid, and one line saying the basemap needs a key), not a tiled watermark. Attribution stays visible and small.
- **Charts.** Recharts or a hand-drawn SVG. Never an image of a chart.
- **Fonts.** Google Fonts by \`<link>\`, with a real fallback stack. Two families, three at most.
- **Icons.** lucide. One icon set for the whole product; never mixed.
- **Video and images.** Real files or a designed placeholder surface with a caption, never a broken image icon and never a stock photo pretending to be the product.

Record the choice on the \`STACK\` line.

# PART 2 — THE SYSTEM

This part carries numbers, because words were not enough. "Three sizes, three weights" produced a page where everything landed between 13px and 16px. These are the values behind two products a team chose over every alternative shown to them, and they hold across every direction unless a direction says otherwise.

## 2.1 Surfaces — three of them, in a fixed order, separated by value

Every screen has at most three surfaces, and they always sit in the same order: **chrome** (the header and the navigation rail) below **page** (the area the content lives in) below **card** (the things on the page). What lifts a card off the page is a change of lightness and a border, not a shadow.

**Light.**

\`\`\`
--chrome:   #ffffff                    /* header + rail, one continuous white */
--page:     hsl(210 33% 98%)           /* faintly cool, so white cards lift off it */
--card:     #ffffff
--border:   hsl(215 28% 90%)
--fg:       oklch(0.18 0.02 280)       /* ink, slightly cool */
--muted-fg: oklch(0.50 0.02 280)
\`\`\`

The content area is an **inset frame**: the page sits inside the chrome as a rounded panel — \`rounded-3xl\`, a hairline border, a small margin from the chrome on three sides. The app has a visible window, and everything the person does happens inside it. This one move is most of the difference between "a website with a sidebar" and "a product".

The rail stays white even when the page is tinted. A tinted rail competed with the content frame; white chrome and a faintly cool page is the pairing that reads as calm.

**Dark.**

\`\`\`
--chrome:   oklch(0 0 0)               /* header + rail: pure black, the same ground */
--page:     oklch(0 0 0)
--card:     oklch(0.145 0 0)           /* #0a0a0a — barely off the ground */
--popover:  oklch(0.218 0 0)           /* #1a1a1a — one step up from the card it opens over */
--border:   oklch(0.281 0 0)           /* #292929 — a REAL line, not an 8% alpha hint */
--fg:       oklch(0.946 0 0)           /* warm cream, not #fff */
--muted-fg: oklch(0.709 0 0)           /* measured: 4.75:1 on a card, over the AA floor */
\`\`\`

Four rules that make dark read as designed rather than dim:

1. **Chroma is zero. Not nearly zero.** A tint of 0.006 is invisible in a swatch and reads as a colour cast across a whole header band, and any hue on a large dark surface competes with the accent — which is the one thing meant to carry colour.
2. **Border-led, not value-led.** Surfaces are barely apart; what makes a card a card is a clearly visible 1px edge. Fewer, flatter surfaces; sharper lines.
3. **No shadows.** A black shadow on a black ground is invisible — paint cost for nothing. Popovers lift by being one step lighter than what they open over.
4. **The warmth lives in the text.** Neutral ground, cream ink. That pairing is what separates considered from clinical, and it is the only warmth in the theme.

And in both themes: **the rail is the lowest surface**, the page next, the cards on top. Invert that order anywhere and the chrome loses its edge.

## 2.2 Colour

**The brand is a triad.** \`--brand\`, \`--brand-strong\` (a step darker, for hover and for text on tinted surfaces), \`--brand-soft\` (a wash at ~8–12% for hover fills and selected rows). Light and dark **share the hue and differ only in lightness** — a value that reads as brand on white reads as nearly-background on black, so the two differ in L and agree on H.

**Check the gamut.** A bright violet or blue chosen in oklch at L 0.78 can sit outside sRGB; the browser clamps it and ships a colour nobody picked — a violet that renders blue, a brand that reads muddy. Run every accent through a gamut check before trusting it.

**Split the fill from the accent when contrast demands it.** The accent as *text* on a dark card must be light enough to read; the accent as a *button fill* must be dark enough for white text on it. Those two pull in opposite directions. If one token cannot serve both — measure it — split out \`--primary-fill\` a step darker and keep the label white. Light mode rarely needs this; dark mode usually does.

**Semantic colour is a set of four, each with a soft pair:** \`--success\`, \`--warning\`, \`--info\`, \`--destructive\`, and \`--success-soft\` and so on. **Soft by default.** A status is a tinted background with dark text of the same hue and, optionally, a small solid dot — never a solid fill with white text unless it is the one state on the row that needs action *now*. At most one solid semantic fill visible per row. Pair every semantic colour with a label or a shape; colour is never the only carrier.

**Categorical colour is for identity, not emphasis.** When a screen has several modules or metrics that must be told apart — a row of KPI tiles, a set of module cards — give each **one tone** from a small fixed palette (violet, sky, mint, peach, rose, amber, slate), used for its eyebrow, its icon and its micro chart, while the card stays white and the type stays neutral. Every tone has a \`-soft\` background and, in dark mode, a brighter \`-fg\` so tinted labels stay legible. The tone says *which one this is*; it does not say *look here*. That job belongs to the accent alone.

**The accent ceiling: under five percent of the pixels on any screen.** Count before you finish.

**Neutrals are chosen.** Light neutrals lean a few degrees cool; dark neutrals are dead zero. Never a default grey.

## 2.3 Type

**Two families with jobs.** A display face for headings — geometric or neo-grotesque, heavy, tight — and a text face for everything a person reads or clicks. Inter for display over Poppins for text is one pairing that works; the point is the split, not the names.

**The floor is 13px.** Nothing on the screen is smaller — no \`text-[10px]\`, no \`text-[11px]\`. If something does not fit at 13px, the fix is less content or more space, not smaller type. Raise the framework's \`text-xs\` token to 13px so the floor holds everywhere at once.

**The scale, in pixels:**

\`\`\`
13  labels, captions, table cells, chips, help text     (text-xs, raised)
14  body — line-height 1.55, tracking -0.005em
16  lead paragraphs, large inputs
18  h4
22  h3 — weight 700, tracking -0.025em
28–40  h2 — weight 800, tracking -0.04em, clamp(1.75rem, 2vw + .75rem, 2.5rem)
36–56  h1 — weight 900, tracking -0.045em, line-height 1.02, clamp(2.25rem, 3vw + 1rem, 3.5rem)
\`\`\`

**Weight and tightness ramp together with size.** The bigger the heading, the heavier and the tighter. Body stays at 400–500 and never letterspaced. \`text-wrap: balance\` on headings, \`pretty\` on paragraphs.

**Sentence case is the house style.** Headings, labels, buttons — sentence case. The one uppercase element is the **eyebrow**: 11–13px, weight 700, tracking 0.08em, in the tone of its card, and only above a heading or a KPI value. Never uppercase as texture.

**Digits align.** \`font-variant-numeric: tabular-nums\` on every figure that sits in a column or beside another figure. That — not monospace — is the fix for aligning numbers.

**Sizes come off the scale, never a bracket literal.** A KPI value set at \`text-[28px]\` made a row of tiles tower over every card beside them; a page with a KPI row, a chart and a list read as three products. \`text-2xl\` and the same \`p-4\` as every other card made it one.

**Monospace is off by default.** It is permitted in exactly three directions below, for at most two roles: an identifier a person would copy, quote or read aloud, and a small eyebrow label. Never body, headings, navigation, buttons, link text, form labels, card titles, stat labels, badge text, quotes, mottos, people's names, prices, or dates written for people. If more than five percent of the visible words on a screen are monospace, the rule is broken. A previous version of this brief called monospace "the most useful signal you have"; the result was a school website where the navigation, the table headers and the tutors' names were all monospaced.

## 2.4 Space and rhythm

**A stack owns the space between its children. A child never owns the space around itself.** No \`mt-*\` or \`mb-*\` on the root element of anything that gets stacked, and no margin on a container to separate it from its sibling — give the *parent* a gap and delete the margin. Margins do not collapse inside a flex container, so a component carrying its own \`mb-4\` produced four different spacings under four different parents, none of them chosen. This one rule is where vertical rhythm comes from.

**The numbers.** The page inset is 12px, one step wider from \`md\` up (\`p-3 md:p-4\`). The gap between any two stacked cards is 12px (\`gap-3\`). A tab panel's cards sit at the same rhythm as a page's cards, so moving a feature into a tab does not re-space it. Inside a card, the inset is \`p-4 md:p-5\`, the same on every card on the page.

**One card recipe.** Every page-level surface — the page header, the filter bar, the table, a detail panel — uses exactly the same radius, border, fill, elevation and padding. Import the recipe; never retype the classes. A stack of three cards that disagree on any of those reads as three unrelated boxes.

**Every side-by-side grid gets \`[&>*]:min-w-0\`.** \`minmax(0,1fr)\` lets a track shrink; the item inside still defaults to its min-content width and overflows the track, and the page grows a horizontal scrollbar. The grid definition looks correct in the source and the layout is broken on screen, which is why this bug survives review. The declaration belongs on the container so it cannot be forgotten on a child.

**Vary the rhythm between sections** on a page that scrolls. Identical padding on every band gives a page no pulse. A dense section earns tighter spacing; a single statement earns air.

**Chrome budget: at most three horizontal bands before the content.** A header, a tab row and a toolbar is the limit. If you have four, merge two. On a canvas screen — a map, a document, a board — the limit is two, and the second should be a card floating over the canvas rather than a band above it.

## 2.5 Shape and depth

**One radius, everything derived.** \`--radius: 10px\`. Then \`sm\` = 0.6×, \`md\` = 0.8×, \`lg\` = 1×, \`xl\` = 1.4×, \`2xl\` = 1.8×, \`3xl\` = 2.2×. Cards are \`2xl\` (18px). The content frame is \`3xl\`. Buttons are pill (\`9999px\`). Icon buttons are \`xl\`. Every form field reads one token, \`--radius-field\`, set to \`lg\` — change it once and every input, select, textarea and date picker changes together. Nested radii step *down* as you go inward. There is no fourth radius invented for one component.

**Elevation, light mode: one recipe.** A hairline and a wide, low, diffuse shadow — \`0 1px 2px oklch(0 0 0 / .04), 0 8px 24px -12px oklch(0 0 0 / .10)\` — on cards. On hover, the card lifts two pixels and the shadow deepens slightly. Dialogs and popovers get one larger shadow. Nothing else has a shadow. **Dark mode: none.** Dark separates by value and border.

**Buttons are flat.** No shadow, no glow, no gradient, on any variant, in any theme. Pill radius, weight 700, tracking -0.005em. The one motion is a press: \`scale(0.96)\` over 180ms on a spring curve. The primary is the brand fill with white text; the secondary is a bordered card surface; the ghost is text with a soft wash on hover. One primary per view.

## 2.6 Motion

One signature move per product, applied consistently. Interaction feedback is 150–250ms; entrances under 800ms; anything that loops is slow or absent. Every animation respects \`prefers-reduced-motion\` and the page is fully usable with motion off.

The moves that have earned their place: a card lifting two pixels on hover; a button pressing to 0.96; a dialog fading in on opacity alone; a skeleton shimmer whose sweep is *lighter* than its base in both themes; a hero illustration drifting on a slow float. A live marker on a map glides between points on an ease-out curve for plausible moves and *snaps* for implausible ones — a date change, a first fix, a jump of more than a kilometre — so it never streaks across the map.

Never: fade-and-slide on every section, a hover transition on every element, parallax, an ambient looping background, or an entrance that delays reading the content.

## 2.7 Copy

Words are design material. Name things the way the person using them would, not how the system stores them. Active voice. A control says exactly what happens, and the confirmation uses the same word. Errors say what went wrong and what to do next. No apologies. Banned: empower, unlock, seamless, elevate, supercharge, revolutionise, game-changing, next level, leverage as a verb, solutions as a noun.

## 2.8 Figures — the rule that stops decoration wearing a unit

A number earns its place on the screen **only if the person would do something differently because of it.** An ETA passes. A remaining balance passes. A count of items waiting passes. A satellite count, an uptime percentage, a vehicle's model name, a running shift timer and a signal accuracy in metres are readouts that make a screen *look* like an instrument and tell the person nothing they can act on. Cut them.

Where a figure passes: specific, with its unit, in tabular numerals, and where a comparison genuinely exists, a small delta beside it — beside, baseline-aligned, not underneath. Where you do not have real data, invent data that is plausible and internally consistent, and say in your summary which figures are invented.

Never ship placeholder content. Not lorem, not "Feature One", not a fake logo row.

## 2.9 The floor — non-negotiable regardless of direction

Body text and every muted label clear a comfortable contrast against their *own* surface — check the muted-on-tinted case, where this always fails. Every interactive element has a visible keyboard focus state that is not colour alone. Focus is trapped in a modal and returned on close. Touch targets are 44px on their smallest side; on a phone, form fields are 16px so the browser does not zoom. Images carry real alt text or \`alt=""\`. One h1 per page, headings in order. Colour never the only carrier of meaning. Loading, empty, error and permission-denied are designed states with a way forward.

## 2.10 Responsive

Design the narrow layout as a layout, not as the wide one stacked. Decide what leaves the screen, what collapses into a sheet, and what scrolls sideways inside itself. Tables become cards or scroll internally — never squeezed. The primary action stays under a thumb. On a phone, navigation is a bottom bar of at most five glyph-and-label items, the active one on a soft brand wash.

## 2.11 Write the reason

Every choice that is not obvious from the code carries a comment saying why, in prose — the constraint it satisfies or the bug it prevents. "13px, not 12: at this density 12 is where the UI stops looking considered." "Delta beside the value, not under: stacked, it owned a row on every tile that had one and none on the tiles that did not." A reader must be able to tell a decision from an accident. This is also how *you* will tell them apart when you come back to it.

# PART 3 — THE NINE DIRECTIONS. CHOOSE ONE.

Each entry: when it is right, when it is wrong, and the specifics that differ from Part 2. Part 2 holds unless the entry says otherwise.

---

## DIRECTION A — EDITORIAL INSTITUTIONAL

**Choose when** the organisation has standing and history and the reader is deciding whether to trust it: schools, universities, museums, hospitals, law firms, foundations, publishers, civic and government bodies, professional institutes.

**Never choose when** the product is a tool people operate daily, or the brand is deliberately young.

**Ground.** Warm paper-white for the page, pure white for cards, deep ink with a trace of brown or blue for text. One banded section may go full ink, inverted.

**Accent.** A single deep, low-chroma colour with institutional weight: burgundy, forest, deep navy, aubergine, bronze. Never a bright saturated blue; that reads as software. Links, the primary button, rules under headings, nothing else.

**Type.** A transitional or old-style serif for display at large size and moderate weight — never 900. A quiet humanist sans for body, labels and navigation. **No monospace.** The eyebrow is small caps of the sans.

**Hero.** Wide measure, left-aligned. Eyebrow, the proposition as a two-line serif heading, one paragraph, one primary action and at most one secondary link. Beside it: a real photograph of the place or the people, or three genuine credentials as text. **No status card. No live readings. An institution does not report its own vital signs to visitors.**

**Sections.** Prose-led. Pull quotes in the serif with a hairline above. Figures inline in sentences or as a small band of three to five large serif numbers with sans captions — not tiles.

**Signature move.** A hairline drawing itself under a section heading as it enters, once. Links underline on hover from the left.

**Illustration.** Photography, engraving, a crest, or single-ink line diagrams. No soft-3D.

**Fail mode.** Adding a status pill, a sparkline, a percentage badge or a live counter. If you find one, you have drifted into Direction C.

---

## DIRECTION B — LIGHT PRODUCT

**Choose when** you are explaining a commercial software product to someone who has not used it: a marketing site, a pricing page, a product tour.

**Never choose when** the audience is already inside the product, or the register is institutional.

**Ground.** White page, a very light neutral for alternating bands. Bordered white cards on the bands; soft-elevated cards on the white.

**Accent.** One deep saturated brand colour — navy-leaning blue, deep violet, strong teal. Semantic green for verified and complete.

**Type.** Sans only. Headings 800–900, large, tight, over a medium-weight grey paragraph. That contrast carries the page. **Monospace: one role at most, an identifier a customer would quote; most product pages need none.**

**Hero.** Two columns. Left: a small rounded pill naming the category; a two-line heading with the accent on the second line; one paragraph; two large pill buttons, one solid with a shadow in the accent's own hue (the one button shadow this brief allows, and only here), one bordered. Right: an honest artefact from the product — a real card from its interface with a header, two figures, one small chart, a real action, and a smaller card overlapping its corner. Behind it, two very soft blurred colour fields at low opacity bleeding off the edges — the one blur this brief allows.

**Cards.** Three columns, each card taking one categorical tone for its icon square, its six-bar micro chart and its hover border, white otherwise. Anatomy: icon in a tinted square beside a bold title; small uppercase label; a large figure with a delta pill baseline-beside it; a hairline; the micro chart with a circular arrow button.

**Signature move.** Card lifts two pixels on hover, the shadow deepens, and a thin bar in its tone wipes in across the top edge from the left.

**The inversion.** One dark section — a heavy-bordered frame around a near-black surface — carrying three live-looking readings. This is where the monospace role goes if you took it.

**Fail mode.** Three identical feature cards differing only in their text. Each must show a different kind of figure.

---

## DIRECTION C — TECHNICAL CONSOLE

**Choose when the person holding the device writes or operates software**: developer tools, infrastructure, observability, APIs, security products, data platforms.

**Never choose when the audience is not technical — and the subject being technical does not make them so.** A GPS-tracking product for van drivers is not a developer tool. A lab-results portal for patients is not a developer tool. This is the direction that gets over-applied; it is seductive and specific, and it makes everything that is not a developer tool look like it is impersonating one.

**Ground.** Part 2's dark ramp exactly: pure black chrome and page, \`#0a0a0a\` cards, a real \`#292929\` border. No navy, no gradient.

**Accent.** One high-chroma colour that survives on black — saturated green, cyan, lime or amber. A mid blue disappears; do not use one. The primary button is white with black text and turns the accent on hover.

**Type.** A neutral grotesque for everything a person reads. **Monospace permitted, two roles at most:** identifiers a developer copies, and small eyebrow labels. Not table headers, not nav, not buttons, not card bodies. Keep it under five percent of the words even here.

**Hero.** Two columns. Left: eyebrow, two-line heading with the second line muted, one paragraph, two buttons. Right: a real artefact — a terminal with plausible output, a node map with one node emphasised, or a code sample with one line highlighted.

**Sections.** A bento grid, six columns, rows at least 320px, cards spanning two, three and six; the six-span horizontal with a drawn SVG graphic on its right half — a node graph, a table with one highlighted row, a waveform. Never an icon scaled up.

**Signature move.** Heading words rising into place from a clipped line on a 60–80ms stagger, *or* figures counting up once on scroll. One of the two.

**The inversion.** A white block — the logo mark, or one card — in the dark page.

**Illustration.** Diagrams only, drawn in SVG with token discipline and no gloss.

**Fail mode.** Monospacing the page, and building this for a non-technical audience.

---

## DIRECTION D — OPERATIONAL DENSE

**Choose when** the person is paid to look at this for hours and the volume is the point: back office, logistics dispatch, trading, clinical systems, moderation queues, a CMS at scale. The product is plumbing and is proud of it.

**Never choose when** the product has a brand it must carry, or the person is not at a desk. For a daily tool that must also feel like a product, choose Direction I.

**Ground.** Part 2's light surfaces, tightened: the page inset drops to 8px, the card gap to 8px, the card inset to \`p-3\`. Cards keep the \`2xl\` radius and the border; the elevation may drop to the hairline alone.

**Accent.** One, used almost entirely for the active state, the focus ring and the primary action. Semantic colour carries the state of every row — soft by default, per Part 2, and always paired with a label.

**Type.** One neutral sans. The 13px floor holds. Body 14, table cells 13, one h1 at 18–20 per screen and no larger heading anywhere. **Monospace: one role, figures inside tabular columns — and \`tabular-nums\` on the sans is almost always the better answer.**

**Layout.** Information density over whitespace. Summary before detail: what needs attention reads at a glance, encoded in form as well as colour — a severity stripe, a chip, a shape. The screen is a **page header card** (title, one-line subtitle, actions right — no icon tile, no breadcrumb, not sticky), a **filter card**, and a **table card**, all three on the same recipe. Tables: sticky header past ten rows, sortable columns with a visible indicator, row hover, keyboard row navigation, a visible count, right-aligned tabular figures, filters that persist and say what is active. Every destructive action confirmed and reversible.

**Signature move.** None. Speed is the aesthetic; the only motion is a 100ms state change and the button press.

**Illustration.** Empty states only, small and flat, one tone.

**Fail mode.** Shipping browser defaults and calling it density. Density is a spacing choice; it is not permission to skip the system.

---

## DIRECTION E — WARM CONSUMER

**Choose when** the product is something a person chooses in their own time and feels something about: recipes, travel, community, wellness, learning, marketplaces, local services, hospitality.

**Never choose when** the register is institutional, technical or luxury.

**Ground.** Warm neutrals — cream, sand, clay, a soft off-white — never grey. Cards white or a lighter warm tone, generous radii.

**Accent.** A warm saturated colour with life in it: terracotta, ochre, deep coral, leaf green. A warm deep neutral for text, not black.

**Type.** A friendly display — a humanist sans with character or a soft serif — over a comfortable humanist body, one step larger than any other direction. **No monospace.**

**Hero.** Photography-led if there are real images; otherwise a large warm typographic statement. One clear action. No status card, no figure.

**Sections.** Content in generous cards with real images and captions in the body face. Figures written into sentences, not tiled.

**Signature move.** Gentle: a card scaling very slightly on hover, an image easing in as it loads.

**Illustration.** The full soft-3D treatment.

**Fail mode.** Grey. The instant a neutral goes cool, the whole page reads as a different product.

---

## DIRECTION F — QUIET LUXURY

**Choose when** the value is restraint and the buyer is not price-sensitive: premium goods, private banking, architecture practices, high-end hospitality, galleries.

**Never choose when** the page must explain a lot, or the audience is in a hurry.

**Ground.** One near-white or one very deep tone, committed to entirely. No banding.

**Accent.** Almost none. One hairline, one deep or metallic tone, used perhaps three times on the whole page. Restraint is the accent.

**Type.** A high-contrast display serif or a refined grotesque at large size and light weight, with wide letter-spacing on the smallest labels only. Very generous line height. **No monospace.**

**Layout.** Enormous whitespace. Few elements. A section may hold one sentence. Full-bleed imagery with nothing over it.

**Signature move.** One slow reveal on the hero, and nothing else. No hover lift, no card shadows.

**Illustration.** None. Space and a photograph.

**Fail mode.** Adding. If a section feels empty, it is finished.

---

## DIRECTION G — UTILITY BRUTAL

**Choose when** honesty beats polish and the audience will respect that: internal tools with no design budget, documentation, changelogs, status pages, indie and open-source projects.

**Never choose when** anyone needs to be persuaded, or the organisation trades on prestige.

**Ground.** Plain white or plain black. System defaults, visibly. Hairline borders, near-square corners, no shadows.

**Accent.** One, unmixed — a plain blue link colour is correct here.

**Type.** A system stack or one plain grotesque. **Monospace permitted, up to two roles** — and this is the one direction where a monospace *body* is legitimate, if taken for the whole body deliberately rather than in fragments.

**Layout.** Single column, generous measure, real headings, real lists. Plain-bordered tables. No cards, no hero.

**Signature move.** None whatsoever.

**Illustration.** None. Not even an empty-state drawing.

**Fail mode.** Decorating it.

---

## DIRECTION H — EXPRESSIVE APP

**Choose when** it is a consumer application people use often and on a phone: social, fitness, habits, music, games, kids' products, creative tools.

**Never choose when** the register is institutional, luxury or operational.

**Ground.** Bold. A saturated colour field, a deep rich dark, or white with very large colour blocks. The only direction where large saturated areas are correct — and even here, one hue family.

**Accent.** A vivid contrasting colour for the primary action, plus the semantic set.

**Type.** A characterful display at very large sizes and heavy weight over a clean sans body. **No monospace.**

**Layout.** Mobile-first, genuinely. Large radii, big targets, a bottom action bar, sheets not modals, one primary action per screen.

**Signature move.** Springy and physical: a button pressing in, a sheet with momentum, a number rolling. Fast, reversible, off under reduced motion.

**Illustration.** The full soft-3D treatment.

**Fail mode.** Centring the phone layout in a column on a wide screen instead of designing the wide layout.

---

## DIRECTION I — REFINED OPERATIONAL

**Choose when** the product is a tool a person uses every day — often for hours, sometimes in motion — *and* it has a brand to carry: a business's own portal, a field team's app, a clinic's scheduling, a distributor's book, a school's staff console. Dense enough to work in; crafted enough that opening it feels like opening a product rather than a spreadsheet. This is the direction for most real applications, and it is the one that was missing when a teacher's attendance register came back as a Bootstrap admin panel and a technician's map came back as mission control.

**Never choose when** nobody is coming back tomorrow (that is Direction B), when the volume is so high that chrome must vanish entirely (Direction D), or when the audience is developers (Direction C).

**Ground.** Part 2 exactly, both themes. Light: white chrome, faintly cool page, white cards, the inset content frame. Dark: the zero-chroma ramp with the real border. The frame is the signature of this direction; do not drop it.

**Accent.** One brand colour with authority — a deep blue, an indigo, a forest green — in its triad. Dark mode splits the fill from the accent so the button label stays white and the accent stays readable as text. **Semantic soft by default. Categorical tones for identity only** — one tone per KPI tile, per module card, per calendar category — with the tile itself white.

**Type.** Part 2's scale exactly, 13px floor, display face for headings and text face for the rest, sentence case, eyebrows in the card's tone. **No monospace.** Tabular numerals on every figure.

**The shell.** A white rail on the left with glyph-and-label items, the active one on a soft brand wash — and the rail collapses to glyphs. A 64px header with the wordmark on one line, truncated, a tagline under it, search in the middle on every page but the one that owns its own search, and the profile on the right. The content frame inside. On a phone the rail becomes a five-item bottom bar.

**The page.** Three cards on one recipe: a compact **page header** (title at 18px display weight, a one-line truncated subtitle, actions right; no icon tile — the rail already shows the glyph; no breadcrumb — the rail shows the section; not sticky — a rounded card pinned to the top leaves gaps down both sides), a **filter card**, and the **content card** — a table, a form, a detail. 12px between them.

**KPI tiles.** Eyebrow in the tile's tone and a plain tone-coloured icon on the top row — no tile behind the icon, no chip, no wash. A \`text-2xl\` display value with the delta pill baseline-beside it. The exact figure small underneath, because the rounded number is what a person reads and the exact one is what they reconcile against their own statement. Subtitle pinned to the bottom so a row of tiles keeps one baseline. \`p-4\` like every other card.

**Canvases.** When the content is a map, a document or a board, **the canvas is the page and everything else is a card over it.** A list panel beside or over the map — avatar, name, status dot, one line — and at most one floating control group. Markers show the person or the thing, never a code; the person's own marker is distinct and glides. Overlays take the *page's* ground, never the opposite: a light map gets white cards, not black ones. No legend box unless there are more than three symbol types, and then it collapses.

**Empty states.** A soft-3D illustration drifting on a slow float, a display-weight title, one line, one action. When the empty state *is* the screen it is a real card filling most of the viewport; when it sits inside something with edges it is a dashed outline on a slate ground. A section that failed to load and a section with nothing in it must never look the same.

**Signature move.** Cards lift two pixels on hover in light; the button press; a skeleton shimmer while loading; a marker gliding. Nothing else.

**Illustration.** The full soft-3D treatment, in the categorical tones.

**Fail mode.** Losing the frame and the recipe and shipping a page of default-styled boxes — which is Direction D without the excuse — or adding dark bars, readouts and code labels because the subject has data in it, which is Direction C without the audience.

# PART 4 — COMPONENTS

The direction decides the shape. This decides the behaviour and the anatomy, everywhere.

**Shell.** The frame in Part 2.1. The rail is the lowest surface. Nothing in the header repeats what the rail already says.

**Page header.** Title, one-line subtitle, actions. Compact. It has been a tall bordered card, a full-bleed sticky band and a card again; the card is right and *compact* is the lesson — the same inset as every other card, the title on one line.

**Buttons.** Flat pill, weight 700, one primary per view. Text says the action — "Book assessment", not "Learn more". Never an arrow appended as decoration. A disabled button says why, or is not shown. Sizes come from one place; three screens each choosing their own is how a shared header ships two button heights.

**Navigation.** Five to seven top-level items. The current one is visibly current by more than colour. On narrow screens it collapses to a real menu or a bottom bar.

**Forms.** One column. Labels above, sentence case, never uppercase, never only inside the field. Required marked on the label. Help text under the field and *kept in the layout* when it turns into an error, so nothing below it moves. Validate on blur. Every field reads \`--radius-field\` and one height. Phone fields at 16px.

**Tables.** Header row by weight and a rule, not a filled band. Tabular figures right-aligned. Row hover. Sticky header past ten rows. A visible count. Narrow screens: cards or an internal scroller, never a squeezed table.

**KPI tile.** Anatomy in Direction I; it holds in every direction that has tiles.

**Chips.** Pill, \`text-xs font-bold\`, a tone's soft background with the tone's text, optional pulsing dot. A **delta** chip is green-up / red-down with an arrow and an \`invert\` for metrics where down is good. A chip whose plain-language label hides an enum carries the enum in its \`title\`.

**Cards.** One recipe. A clickable card is a button or a link, not a div with a handler, and shows a focus ring.

**Empty, loading, error.** Loading is a skeleton in the shape of the content, never a spinner in a void. Empty says what belongs here and offers the one action that fills it. Error says what failed and what to do. Permission-denied says who to ask. Distinguish "nothing here" from "failed to load" in form, not only in words.

**Dialogs and sheets.** Per 1.2. The overlay blurs and saturates; the panel fades on opacity alone.

**Toasts.** Per 1.2. Never over the control they report on.

**Maps.** Per Part 1.3 for the library. The map fills its container; the container is a card with the page's radius and the map's own focus outline killed so it does not clip the corners. Markers: the person's initial or avatar in a tone, the self-marker distinct, tapping one opens a card not a bubble. Clustering past ~50 markers. Labels declutter — never two labels overlapping. Polylines in the brand at 60% opacity, 4px. A live marker glides on plausible moves and snaps on implausible ones. Controls: one floating group, top-right, three buttons at most. Attribution small, visible, bottom-right. Dark map style only when the direction is dark.

**Footer.** Real links, grouped, with the legal and contact information the organisation is obliged to show.

# PART 5 — ILLUSTRATION

Most products reach for illustration in four places and get it wrong the same way each time: a stock vector, an icon scaled to 200px, or a raster that does not match the palette and never will.

## 5.1 Where

Empty states — one per empty thing, drawn as that thing. Error and permission pages, each visually distinct. Authentication, one scene. Confirmations: success and waiting. Stat tiles, when the direction has tiles. One hero object. Nowhere else.

## 5.2 The technique — soft-3D, hand-built in SVG

Inline SVG in the codebase. No image files, no icon library scaled up, no raster. It re-colours with the palette, stays sharp, costs no request, and can be edited.

**Structure.** One component per illustration, taking a \`className\`. A \`viewBox\`, no fixed size. Canvases: ~240×200 hero, ~200×180 empty state, ~140×100 stat tile.

**Ids are namespaced.** Every gradient id gets a short prefix unique to its component — \`eb-shadow\`, \`stv-front\`. Two illustrations on one page sharing an id called \`shadow\` silently steal each other's gradients, and the bug looks like a rendering glitch rather than a name collision.

**Colour from tokens, never literals.** Every fill is \`var(--brand)\`, a categorical tone, or a semantic token. Tints and shades are mixed: \`color-mix(in oklch, var(--brand) 32%, white)\` for a tint, \`78%, black)\` for a shade. Pure white only as gloss and paper, under 50% opacity. Structural greys are the foreground token at 0.08–0.22. Change the brand and every illustration re-skins.

**Form.** One focal object, low detail. Four moves, all needed: a **contact shadow** (an ellipse under the object, radial from the foreground token at ~0.16 to transparent); **light from the top-left** (gradients \`x1="0" y1="0" x2="0.3" y2="1"\`, light stop first, every face agreeing); **one gloss** (a small white ellipse at 0.1–0.5 on the lit face); **generous radii** (10–20 on a 100px form). Isometric solids: top lightest, left middle, right darkest. Depth between flat things: a second copy behind, rotated two to four degrees.

**Text inside is abstracted** — rounded bars at low opacity — never lettered. **State is carried by the semantic colour** the interface uses. **Accessibility:** \`role="img"\` and an \`aria-label\` naming the meaning — \`"Waiting for approval"\`, never \`"Clipboard with clock"\`.

**Motion.** A hero object may float on a four-to-six second ease-in-out loop with its shadow scaling in counterpoint. One object, never an empty state, off under reduced motion.

## 5.3 Which directions

Full soft-3D: **B, E, H, I.** Line art, photography or a crest: **A.** Diagrams without gloss: **C.** Small flat empty states only: **D.** None: **F, G.** Illustration is not universal, for the same reason the console look is not.

# PART 6 — NEVER SHIP THESE

Each is answerable yes or no about the finished page.

1. A native \`<select>\`, date, time, file or colour input rendered raw.
2. A browser default focus ring, or no focus ring.
3. A basemap tiled with "API KEY REQUIRED", or any watermarked third-party surface.
4. Monospace outside the roles Part 2.3 permits for your direction.
5. A readout that changes nothing the person does — satellite counts, shift timers, uptime, a vehicle model in the header.
6. More than three horizontal bands of chrome before the content; more than two over a canvas.
7. Dark overlays scattered on a light map, or light ones on a dark map.
8. A shadow on a button, in any variant.
9. Two solid semantic fills in one row.
10. Any text under 13px.
11. A size, colour or radius written as a bracket literal.
12. A margin on the root of a component that gets stacked.
13. A grid row without \`[&>*]:min-w-0\`.
14. A centred hero: headline, subheading, two buttons, device mockup, stacked on the centre line.
15. A row of three or six identical feature cards, each an icon in a tinted square above a heading and two lines.
16. Placeholder content of any kind.
17. A decorative gradient — allowed only where it encodes data, and the one hero blur in Direction B.
18. Emoji as an icon, a bullet or a section marker.
19. Everything centred. Body copy is left-aligned.
20. Identical vertical padding on every section.
21. A fourth corner radius.
22. More than one elevation level in light, or any shadow in dark.
23. Uppercase eyebrows used as texture, or any heading, label or button in uppercase.
24. Numbered section eyebrows on content that is not a sequence.
25. A single word in a headline given a different colour or face.
26. Decorative status dots beside every list item.
27. An arrow appended to link text.
28. Metadata strung together with middle dots.
29. An icon tile beside a page title that the rail already shows.
30. A breadcrumb on a two-level route.
31. A fake product UI built from divs as hero decoration.
32. Abstract filler shapes.
33. Frosted glass where nothing overlaps.
34. Entrance animation on every section; hover transition on every element.
35. Marketing filler: empower, unlock, seamless, elevate, supercharge, revolutionise.
36. A light/dark toggle nobody asked for.
37. Four stat tiles across the top when the product does not have four things worth counting.
38. A stock illustration, a scaled-up icon, or a raster where a drawing belongs.
39. A hard-coded colour inside an SVG.
40. A skeleton that does not match the shape of what it stands in for.

# PART 7 — AUDIT, THEN FILL THE RECORD

Run every check. Fix what fails. Then fill the \`AUDIT\` and \`MEMORABLE\` lines of the Decision Record with the results — the record is not complete until they are real.

1. **The scene.** Reread your paragraph. Does the screen serve *that* person in *that* moment? Name one element that would be different if the scene were different.
2. **Direction.** Does the finished page match the direction you named? Name the one detail that would change under a different direction.
3. **Native controls.** Count them. The number is zero.
4. **Third-party surfaces.** Any watermark, any broken tile, any missing-key state that was not designed?
5. **Monospace.** Percentage of visible words, and every role it appears in.
6. **Accent.** How many colours carry emphasis? Under five percent of the pixels?
7. **Semantic.** Any row with two solid fills? Any status carried by colour alone?
8. **Figures.** For each number on the screen: what would the person do differently because of it? Cut the ones with no answer.
9. **Chrome.** Count the horizontal bands above the content.
10. **Type.** Smallest size on the page. Any bracket literal. Any uppercase outside an eyebrow.
11. **Space.** Any margin on a stacked root. Any grid without \`min-w-0\`. Is the card gap one number?
12. **Depth.** Radii in use. Elevation levels. Any shadow in dark. Any shadow on a button.
13. **Motion.** One idea? Works with motion off?
14. **Floor.** Contrast on muted-over-tinted. Focus states. 44px targets. One h1. Alt text. Designed empty, error and denied states, distinguishable from each other.
15. **Narrow.** Designed, or the wide one stacked?
16. **Illustration.** Stock art, scaled icons, raster, hard-coded colours, unprefixed ids, lettered text?
17. **The 0.5 test.** Does the page avoid the wrong impression you named?
18. **Dullness.** Name the one memorable thing on this screen. If you cannot, add one — and if what you built would be indistinguishable from a template, say so and change it.
19. **Reasons.** Does every non-obvious choice have a comment saying why?

Report as a short list: what you checked, what failed, what you changed. Then the completed record.

# THE PRODUCT

`

/** Appended after the brief so the reader's own description closes the prompt. */
export const MASTER_DESIGN_SLOT =
  "[describe your product in two or three sentences — what it is, who opens it, and the one thing they came to do]"
