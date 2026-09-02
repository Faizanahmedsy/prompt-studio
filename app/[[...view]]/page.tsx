import { notFound } from "next/navigation"

import { modeFromSlug } from "@/lib/view-url"

import { StudioApp } from "./studio"

/**
 * The studio, at `/` and at one path per tab.
 *
 * The catch-all is validated here rather than left open: without this every
 * unknown path — a typo, a stale link, a crawler guessing — would render the
 * whole application and answer 200, so nothing on the site could ever 404.
 */
export default async function StudioPage({
  params,
}: {
  params: Promise<{ view?: string[] }>
}) {
  const { view } = await params
  if (view?.length) {
    if (view.length > 1 || !modeFromSlug(view[0])) notFound()
  }
  return <StudioApp />
}
