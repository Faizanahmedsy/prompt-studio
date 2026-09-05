/**
 * The tab, in the address bar.
 *
 * Every tab was view state in a store, so the URL was `/` no matter what you
 * were looking at: a link to the design editor could not be sent, a reload
 * landed wherever the store happened to be, and the back button left the app
 * entirely. The path now carries it — `/design`, `/data`, `/code` — and the
 * store still owns the state, with the URL kept in step behind it.
 *
 * Deliberately a slug map rather than the mode names: the mode is called
 * `theme` internally and the tab has been labelled Design since it stopped
 * being a colour picker, and `/theme` in a shared link would be the one name
 * nobody in the product uses.
 */

import type { WorkMode } from "@/stores/use-ui-store"

export const VIEW_SLUGS: Record<WorkMode, string> = {
  web: "web",
  mobile: "mobile",
  backend: "backend",
  landing: "landing",
  data: "data",
  code: "code",
  discovery: "discovery",
  theme: "design",
}

const BY_SLUG = new Map(
  Object.entries(VIEW_SLUGS).map(([mode, slug]) => [slug, mode as WorkMode])
)

/** `null` for anything unknown — a stale or hand-typed link opens the default tab. */
export function modeFromSlug(slug: string | undefined | null): WorkMode | null {
  if (!slug) return null
  return BY_SLUG.get(slug.toLowerCase()) ?? null
}

/**
 * The URL for a tab, keeping the project.
 *
 * The project rides in the query rather than the path because it is optional:
 * a link with an id this browser has never seen still has to open something,
 * and `/design` alone is a perfectly good link to send.
 */
export function viewUrl(mode: WorkMode, projectId?: string | null): string {
  const path = `/${VIEW_SLUGS[mode]}`
  return projectId ? `${path}?p=${encodeURIComponent(projectId)}` : path
}

/**
 * The local project a `?p=` link means.
 *
 * Two id spaces exist for one project: the local one this browser invented and
 * the remote one the server assigned. Every tool, skill and MCP reply prints
 * the remote id — it is the only one that exists off this machine — while the
 * project store is keyed by the local id. So a link is either already local, or
 * it names the remote half of something local, and the sync store knows which.
 * `null` when neither: a link from somebody else's machine still opens the tab.
 */
export function projectFromLink(
  wanted: string | null | undefined,
  isLocal: (id: string) => boolean,
  localIdOf: (remoteId: string) => string | null
): string | null {
  if (!wanted) return null
  return isLocal(wanted) ? wanted : localIdOf(wanted)
}
