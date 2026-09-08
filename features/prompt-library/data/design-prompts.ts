import { MASTER_DESIGN_PROMPT, MASTER_DESIGN_SLOT } from "./master-design-prompt"
import type { LibraryPrompt } from "./types"

/**
 * The design prompts.
 *
 * There used to be three of these — a shared brief and two ground-specific
 * variants — and they were replaced by one because the split was the bug. Each
 * described a single look and gave no way to decide whether that look suited
 * the project, so a school website came back built as a telemetry console:
 * monospaced navigation, a live attendance counter in the hero, status pills
 * beside the house mottos. Every individual instruction had been followed.
 *
 * The master prompt makes the choice explicit instead: classify the project,
 * name one of eight directions, then build. The evidence underneath it is
 * unchanged — five complete builds of one site, shown to a team, two picked —
 * but what the winners shared is now separated from what made them different,
 * and only the first half is asserted as universal.
 */
export const designPrompts: LibraryPrompt[] = [
  {
    id: "master-design",
    title: "Master design brief",
    blurb:
      "Write the scene, pick one of nine directions, then build — the stack, a token system with real numbers, components, illustration, a never-list and an audit that fills a decision record.",
    category: "Design",
    tags: [
      "design",
      "ui",
      "landing page",
      "web app",
      "visual",
      "principles",
      "master",
      "direction",
      "shadcn",
      "tailwind",
      "tokens",
      "typography",
      "accessibility",
    ],
    howToUse:
      "Paste the whole thing, then describe your product at the end. Say what device and what situation if you know — it changes the answer. It will write a Decision Record as a comment at the top of the main file; read the DIRECTION and AUDIT lines first, and if the direction is wrong, quote the record back and ask it to re-pick.",
    body: `${MASTER_DESIGN_PROMPT}${MASTER_DESIGN_SLOT}`,
  },

  {
    id: "design-critique",
    title: "Critique a design you already have",
    blurb:
      "Hand it a screenshot or the markup and get a specific list of what is generic and what to change.",
    category: "Design",
    tags: ["design", "critique", "review", "feedback", "audit"],
    howToUse:
      "Attach a screenshot, or paste the component's markup and CSS. Works best on one screen at a time.",
    body: `Critique the interface below as a design lead would in a working review — specific, unsentimental, and about this screen rather than about design in general.

Judge it against these, in this order:

1. **Register.** What kind of organisation does this look like it belongs to — an institution, a software company, a developer tool, a shop, a luxury brand, an internal system? Now say what it actually is. If those two answers differ, that is the finding, and it outranks everything below: a school that looks like a monitoring dashboard has a bigger problem than any spacing on the page.
2. **Monospace.** Roughly what share of the visible words are in a monospace face? Anything above about five percent is a fault, and monospace on navigation, headings, buttons, body text, form labels, people's names or table headers is a fault at any share. List every place it appears and say which two roles, at most, should keep it.
3. **Accent discipline.** How many colours carry emphasis? Name them. If more than one is doing emphasis rather than meaning, say which to cut.
4. **Evidence.** Is every number specific, with a unit, and plausibly from somewhere? Quote any that read as placeholder.
5. **Hierarchy.** Squint at it. What reads first? Is that the thing that should read first?
6. **Rhythm.** Do sections have different vertical padding, or is every band the same height? Is the grid uneven, or is it a row of identical cards?
7. **Voice.** Is any body copy letterspaced, centred, or written in marketing language — empower, unlock, seamless, elevate?
8. **Depth.** Count the elevation levels and the corner radii in use. More than one shadow level or more than three radii is a finding.
9. **Motion.** Is there one idea applied consistently, or several scattered?
10. **Generic signatures.** Name any of these you find: centred hero with a device mockup, three identical feature cards, decorative gradient, emoji as icons, abstract blurred blobs, a link with an arrow appended to its text, metadata joined by middle dots, numbered eyebrows on unordered content.

Then give me:

- **The three changes with the highest ratio of improvement to effort**, each as a concrete instruction — which element, what to change it to, and why that is better. Not "improve contrast"; "the grey on the card subtitle is too light against the card surface — take it two steps darker so it clears a comfortable reading contrast".
- **One thing that is already working**, and why, so I do not break it.
- **The single riskiest change** — the one that would most improve it if it lands and most damage it if it does not.

Do not rewrite the whole thing. Do not compliment it before the critique. If a section is fine, say nothing about it.

Here is the design:

[paste the markup, or attach the screenshot]`,
  },

  {
    id: "first-screen",
    title: "Decide what the home screen is",
    blurb:
      "Stops an assistant putting a dashboard of metric tiles on the home page of a product nobody operates.",
    category: "Design",
    tags: ["design", "product", "home", "entry", "information architecture"],
    howToUse:
      "Use this before asking anything to build the app, or on its own to settle an argument about the home page.",
    body: `I am going to describe a product. Before you design or build anything, decide what its first screen is, and defend the decision.

Answer these two questions first, out loud:

1. **Who opens this?** Someone paid to operate it — staff, an admin, a dispatcher, a back office — or someone who chose to use it, a customer or a member of the public?
2. **What single thing did they come to do?** One verb and one noun, in their words rather than the operator's. "Pin a place I want to go", not "manage bucket lists". "Find a plumber near me", not "browse service providers".

Then apply this rule: **the first screen renders that one thing, at full size, as the first thing on the page.** Not a summary of it. Not a set of cards leading to it.

- If the answer is a place, a map fills the screen with search over it.
- If the answer is something to read or watch, the collection itself fills the screen.
- If the answer is something to find, the search field is the largest element on the page.
- If the answer is something to capture, the composer or the camera is already open.

Metric cards, KPI tiles, activity feeds and a grid of tiles linking to the other screens belong to operators. Put them on the first screen only if the person genuinely opened the product to monitor or report on something. For a product members of the public choose to open, a dashboard home screen is wrong even when every screen behind it is right.

Then check yourself before you answer:

- Someone opens this for the first time, having been told one sentence about what it does. Can they do that thing immediately, or does the screen describe the product to them first?
- Is the largest element the thing they came for, or is it navigation?
- Would this same first screen fit a different product in the same industry? If yes it is generic, and generic here means a dashboard.

Give me: the two answers, the first screen in a short paragraph, the three or four screens behind it, and one sentence on what you deliberately left off the first screen.

The product:

[describe it in two or three sentences]`,
  },
]
