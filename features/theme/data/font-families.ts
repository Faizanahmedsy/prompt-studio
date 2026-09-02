/**
 * The families a person can actually choose, and what each one is for.
 *
 * Every family here is on Google Fonts, for the same reason the presets only
 * name Google faces: the generated project will not have anyone's licence, and
 * a font named in a prompt that the build agent cannot fetch produces either a
 * broken `@font-face` or a silent fallback nobody notices for a week.
 *
 * Split by role rather than listed once, because the roles want different
 * things. A display face can be as characterful as it likes at 40px and be
 * unreadable at 14; a body face has to survive a paragraph. Faces that do both
 * appear in both lists, which is the point — Source Sans 3 setting its own
 * headings is a legitimate choice, and Fraunces setting a paragraph is not.
 *
 * `category` exists for pairing, not for grouping the picker: the shuffle needs
 * to know that two geometric sans faces beside each other read as a mistake
 * rather than a decision.
 */

export type FontCategory = "grotesque" | "geometric" | "humanist" | "serif" | "slab" | "display" | "mono"

export type FontFamily = {
  /** the Google Fonts family name, exactly as the API spells it */
  name: string
  category: FontCategory
  /** one line, so the choice can be made without loading all of them */
  note: string
}

export const displayFamilies: FontFamily[] = [
  { name: "Inter", category: "grotesque", note: "Neutral, tight, the safe workhorse" },
  { name: "Inter Tight", category: "grotesque", note: "Inter with the air taken out of it" },
  { name: "Archivo", category: "grotesque", note: "Sturdy, slightly condensed, American gothic" },
  { name: "Archivo Black", category: "display", note: "One weight, very heavy, for short headings" },
  { name: "Libre Franklin", category: "grotesque", note: "Franklin Gothic — institutional and plain" },
  { name: "Public Sans", category: "grotesque", note: "A government face: unfussy and legible" },
  { name: "Space Grotesk", category: "grotesque", note: "Quirky terminals, technical without the mono" },
  { name: "Barlow", category: "grotesque", note: "Slightly rounded, low contrast, industrial" },
  { name: "Oswald", category: "display", note: "Condensed uppercase headings that stack tightly" },
  { name: "Anton", category: "display", note: "Very condensed and very heavy — posters only" },
  { name: "Bebas Neue", category: "display", note: "All caps, tall and narrow, editorial covers" },
  { name: "Manrope", category: "geometric", note: "Modern, even, a touch of warmth in the bowls" },
  { name: "Outfit", category: "geometric", note: "Near-circular, very even, product-launch modern" },
  { name: "Jost", category: "geometric", note: "Futura in the browser — geometric and precise" },
  { name: "Poppins", category: "geometric", note: "Perfect circles, generous counters, friendly" },
  { name: "Sora", category: "geometric", note: "Geometric with squared joints — quietly technical" },
  { name: "Plus Jakarta Sans", category: "geometric", note: "Rounded geometric with a wide lowercase" },
  { name: "Rubik", category: "geometric", note: "Soft corners on a geometric skeleton" },
  { name: "Baloo 2", category: "display", note: "Round and heavy, playful without being childish" },
  { name: "Nunito", category: "humanist", note: "Rounded terminals, warm, approachable" },
  { name: "Source Sans 3", category: "humanist", note: "Adobe's humanist workhorse — calm at any size" },
  { name: "IBM Plex Sans", category: "humanist", note: "Engineered humanist, distinctive a and g" },
  { name: "PT Sans", category: "humanist", note: "The face every intranet was set in, done well" },
  { name: "Figtree", category: "humanist", note: "Friendly, slightly geometric, good at large sizes" },
  { name: "Playfair Display", category: "serif", note: "High contrast Didone — luxury and editorial" },
  { name: "Cormorant Garamond", category: "serif", note: "Very fine strokes; only convincing above 28px" },
  { name: "Fraunces", category: "serif", note: "Soft, wonky, optical sizing — boutique premium" },
  { name: "Lora", category: "serif", note: "Brushed contrast, warm, reads as authored" },
  { name: "Libre Baskerville", category: "serif", note: "Book Baskerville widened for screens" },
  { name: "Source Serif 4", category: "serif", note: "A text serif that also holds up as a heading" },
  { name: "Instrument Serif", category: "serif", note: "Narrow, high contrast, one weight — very current" },
  { name: "Roboto Slab", category: "slab", note: "Even slabs, no personality to fight your content" },
  { name: "Zilla Slab", category: "slab", note: "Slabs with cut terminals — Mozilla's face" },
  { name: "Chivo Mono", category: "mono", note: "A monospace used as a display face, deliberately" },
  { name: "Roboto Mono", category: "mono", note: "The default monospace, set large" },
]

export const bodyFamilies: FontFamily[] = [
  { name: "Inter", category: "grotesque", note: "The default for interface text, and the fallback" },
  { name: "Inter Tight", category: "grotesque", note: "Denser Inter, for compact surfaces" },
  { name: "Archivo", category: "grotesque", note: "Slightly condensed, so more words fit a line" },
  { name: "Libre Franklin", category: "grotesque", note: "Plain and institutional at paragraph sizes" },
  { name: "Public Sans", category: "grotesque", note: "Neutral, wide apertures, very legible small" },
  { name: "Barlow", category: "grotesque", note: "Low contrast, industrial, calm in a table" },
  { name: "IBM Plex Sans Condensed", category: "grotesque", note: "Narrow, for dense data screens" },
  { name: "Space Grotesk", category: "grotesque", note: "Characterful — keep the paragraphs short" },
  { name: "Work Sans", category: "grotesque", note: "Optimised for screen, slightly quirky italics" },
  { name: "DM Sans", category: "geometric", note: "Low contrast geometric, very even colour" },
  { name: "Manrope", category: "geometric", note: "Even and modern, holds up at 14px" },
  { name: "Plus Jakarta Sans", category: "geometric", note: "Wide lowercase, friendly in a form" },
  { name: "Karla", category: "geometric", note: "Grotesque skeleton with odd, likeable details" },
  { name: "Nunito Sans", category: "humanist", note: "Nunito without the rounding — warm and plain" },
  { name: "Source Sans 3", category: "humanist", note: "Calm, humanist, disappears behind the content" },
  { name: "IBM Plex Sans", category: "humanist", note: "Engineered warmth; pairs with its own mono" },
  { name: "PT Sans", category: "humanist", note: "Compact humanist, strong at small sizes" },
  { name: "Figtree", category: "humanist", note: "Friendly and open, good for product copy" },
  { name: "Source Serif 4", category: "serif", note: "A serif you can actually set a paragraph in" },
  { name: "Lora", category: "serif", note: "Warm text serif — long-form and editorial" },
  { name: "Libre Baskerville", category: "serif", note: "Wide and readable; needs a long line" },
]

export const monoFamilies: FontFamily[] = [
  { name: "JetBrains Mono", category: "mono", note: "Tall x-height, built for code at 13px" },
  { name: "IBM Plex Mono", category: "mono", note: "Humanist monospace, pairs with Plex Sans" },
  { name: "Fira Code", category: "mono", note: "Ligatures, if the project wants them" },
  { name: "Geist Mono", category: "mono", note: "Neutral and current — Vercel's monospace" },
  { name: "Roboto Mono", category: "mono", note: "The plainest option, and a safe default" },
  { name: "Space Mono", category: "mono", note: "Quirky and wide — figures with personality" },
  { name: "DM Mono", category: "mono", note: "Light, low contrast, good for small figures" },
  { name: "Chivo Mono", category: "mono", note: "Grotesque monospace with sharp terminals" },
  { name: "Anonymous Pro", category: "mono", note: "A terminal face; reads as a fixed-width serif" },
  { name: "Courier Prime", category: "mono", note: "Courier redrawn — typewriter, on purpose" },
  { name: "PT Mono", category: "mono", note: "Narrow and technical, good in dense tables" },
  { name: "Barlow Condensed", category: "mono", note: "Not a monospace: condensed figures, by choice" },
]

/** Every family the picker can produce, for the preview's font loader. */
export const allFamilies = [
  ...new Set([...displayFamilies, ...bodyFamilies, ...monoFamilies].map((f) => f.name)),
]

/**
 * A pairing, not three independent draws.
 *
 * Two faces from the same category beside each other read as a mistake — the
 * reader sees two things that are almost the same rather than a hierarchy — so
 * the body face is drawn from a different category unless the display face is
 * one of the workhorses that legitimately sets its own body text.
 */
export function randomPair(pick: () => number = Math.random): {
  display: string
  body: string
  mono: string
} {
  const choose = <T,>(list: T[]): T => list[Math.floor(pick() * list.length)]
  const display = choose(displayFamilies)

  // A face that appears in both lists can set both, and one in four times it
  // does — a single-family design is a real decision, not an absence of one.
  const selfSet = bodyFamilies.find((f) => f.name === display.name)
  if (selfSet && pick() < 0.25) {
    return { display: display.name, body: display.name, mono: choose(monoFamilies).name }
  }

  const contrast = bodyFamilies.filter((f) => f.category !== display.category)
  const body = choose(contrast.length ? contrast : bodyFamilies)
  return { display: display.name, body: body.name, mono: choose(monoFamilies).name }
}
