import type { ProjectDoc, Surface } from "@/types/project"

/**
 * The shape of a project that ships more than one build.
 *
 * Three builds could be three repositories, and that is how most teams end up
 * doing it by hand. One repository is chosen here for a specific reason: the
 * contract. Web and mobile both consume the same API, and when the types live
 * in one package that both import, a change to an endpoint breaks the two
 * clients at compile time rather than in production. Three repositories can
 * only share that contract by copying it, and a copied contract drifts.
 *
 * It also makes the integration testing possible at all: one checkout, one
 * command, a database and an API the tests can actually start.
 */
export const buildFolder: Record<Surface, string> = {
  web: "apps/web",
  mobile: "apps/mobile",
  backend: "services/api",
}

export type SelectedBuilds = ProjectDoc["builds"]

/** The builds this project ships, in the order the prompt should describe them. */
export function selectedSurfaces(doc: ProjectDoc): Surface[] {
  const order: Surface[] = ["backend", "web", "mobile"]
  return order.filter((surface) => doc.builds[surface])
}

/**
 * Whether the prompt has to describe a repository at all.
 *
 * One build is just a project, and wrapping it in `apps/web` buys nothing but a
 * longer path. The monorepo only earns its keep once something has to be shared.
 */
export function isMultiBuild(doc: ProjectDoc): boolean {
  return selectedSurfaces(doc).length > 1
}

/**
 * The tree, drawn for exactly the builds that were selected.
 *
 * Generated rather than written out: a project shipping web and backend should
 * not be handed an `apps/mobile` folder to wonder about.
 */
export function repoTree(doc: ProjectDoc, projectName: string): string {
  const surfaces = selectedSurfaces(doc)
  const slug = folderName(projectName)
  const lines = [`${slug}/`]

  if (surfaces.includes("web") || surfaces.includes("mobile")) {
    lines.push("  apps/")
    if (surfaces.includes("web")) lines.push("    web/            # the browser app")
    if (surfaces.includes("mobile")) lines.push("    mobile/         # the phone app")
  }
  if (surfaces.includes("backend")) {
    lines.push("  services/")
    lines.push("    api/            # the service, its migrations and its tests")
  }
  lines.push("  packages/")
  lines.push("    shared/         # the API contract, and nothing else")
  if (surfaces.includes("backend")) {
    lines.push("  docker-compose.yml  # database (and anything else the API needs) for local work and CI")
  }
  lines.push("  README.md           # how to run every build, and how to run the tests")
  return lines.join("\n")
}

export function folderName(projectName: string): string {
  return (
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "app"
  )
}
