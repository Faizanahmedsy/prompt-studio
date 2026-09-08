import { notFound } from "next/navigation"

import { modeFromSlug } from "@/lib/view-url"

import { StudioApp } from "./studio"

/**
 * The studio, at one path per tab.
 *
 * It used to answer `/` as well. `/` is the public landing page now, so this
 * is a required catch-all rather than an optional one — and the validation
 * below matters more than before: without it every unknown path would render
 * the whole application and answer 200, so nothing on the site could 404.
 */
export default async function StudioPage({
  params,
}: {
  params: Promise<{ view: string[] }>
}) {
  const { view } = await params
  if (view.length > 1 || !modeFromSlug(view[0])) notFound()
  return <StudioApp />
}
