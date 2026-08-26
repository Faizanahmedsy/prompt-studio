import { surfaceMeta } from "@/features/builder/utils/surfaces"
import { findStackOption } from "@/features/stack/data/stack-catalogue"
import type { ProjectDoc, Surface } from "@/types/project"

import { BOILERPLATE } from "./boilerplate"
import { type BuiltPrompt, buildPrompt, collectWarnings } from "./build-prompt"
import { dataModelBlock } from "./data-model"
import { buildFolder, repoTree, selectedSurfaces } from "./monorepo"
import { getTarget, type ProjectBlockId } from "./targets"

/**
 * One prompt, every build.
 *
 * `buildPrompt` describes a single surface, which is right for the tab you are
 * looking at and wrong for the thing this product is actually for: handing a
 * coding agent one brief and getting back a working system. A person who has
 * said "web, mobile and an API" wants those three wired to each other and
 * tested together, not three briefs to run separately and reconcile by hand.
 *
 * Composed from the per-surface builds rather than rewritten, so a change to
 * how screens are described reaches every build at once and the two can never
 * disagree.
 */
export function buildProjectPrompt(doc: ProjectDoc): BuiltPrompt {
  const surfaces = selectedSurfaces(doc)
  const target = getTarget(doc.target)

  // Nothing to compose. One build is a project, not a system.
  if (surfaces.length <= 1) {
    return buildPrompt(doc, { surface: surfaces[0] ?? "web" })
  }

  const perSurface = surfaces.map((surface) => ({
    surface,
    built: buildPrompt(doc, { surface }),
  }))

  const sections: string[] = []
  const blocks: BuiltPrompt["blocks"] = []

  const push = (id: ProjectBlockId, title: string, body: string) => {
    const trimmed = body.trim()
    if (!trimmed) return
    blocks.push({ id, title, body: trimmed })
    // Same tag rule as a single-build prompt, so the two read alike.
    const tag = id.replace(/[^a-z]/g, "_")
    sections.push(
      target.format === "xml"
        ? `<${tag}>\n${trimmed}\n</${tag}>`
        : `## ${title}\n\n${trimmed}`
    )
  }

  push("overview", "Overview", overview(doc, surfaces))
  push("repository", "One Repository", repository(doc, surfaces))
  // Excluded from the per-build sections below, so it has to be stated here or
  // a project with the boilerplate switched on gets no clone instruction at
  // all — it would silently scaffold the web app from scratch.
  push("boilerplate", "Start From The Boilerplate", boilerplate(doc, surfaces))
  // Before the builds, and stated once: the tables are what all of them read
  // and write, and a schema repeated per build is a schema that disagrees
  // with itself by the third repetition.
  push("data_model", "Data Model", dataModelBlock(doc))

  // Each build keeps its own screens, journeys, stack and structure. The
  // shared blocks — overview, design, conventions, delivery — are lifted out
  // so they are stated once for the whole system rather than three times with
  // small differences nobody intended.
  const sharedIds = new Set([
    "overview",
    "boilerplate",
    "data_model",
    "design",
    "conventions",
    "delivery",
  ])
  for (const { surface, built } of perSurface) {
    const body = built.blocks
      .filter((block) => !sharedIds.has(block.id))
      .map((block) => `### ${block.title}\n\n${block.body}`)
      .join("\n\n")
    push(
      `build_${surface}` as ProjectBlockId,
      `${surfaceMeta[surface].label} — \`${buildFolder[surface]}\``,
      body
    )
  }

  // The design system is one system across the builds; saying it per build is
  // how a phone app ends up a different product from its own website.
  const design = perSurface.find((entry) => entry.surface !== "backend")?.built.blocks.find(
    (block) => block.id === "design"
  )
  if (design) push("design", "Design System", design.body)

  const conventions = perSurface[0]?.built.blocks.find((block) => block.id === "conventions")
  if (conventions) push("conventions", "Conventions", conventions.body)

  push("integration", "Wiring The Builds Together", integration(doc, surfaces))
  push("integration_tests", "Proving It Works End To End", integrationTests(doc, surfaces))
  push("delivery", "Definition of Done", delivery(surfaces, perSurface))

  const text = [target.preamble(doc.name), ...sections, target.closing]
    .filter(Boolean)
    .join("\n\n")

  return {
    text,
    blocks,
    // Checked against the whole document, not gathered from each build.
    //
    // Aggregating per-surface warnings reported things that are true of one
    // build and false of the project: the service has no transitions between
    // its endpoint groups, so every three-build project was told "no
    // connections yet" while its clients were fully wired, and a role tagged
    // only on web screens was reported as tagged nowhere.
    warnings: [...collectWarnings(doc), ...projectWarnings(doc, surfaces)],
  }
}

function overview(doc: ProjectDoc, surfaces: Surface[]): string {
  const names = surfaces.map((surface) => surfaceMeta[surface].label.toLowerCase())
  const counts = surfaces.map((surface) => {
    const screens = doc.screens.filter((screen) => screen.surface === surface).length
    return `${screens} ${surfaceMeta[surface].label.toLowerCase()} ${
      surface === "backend" ? (screens === 1 ? "service" : "services") : screens === 1 ? "screen" : "screens"
    }`
  })
  return [
    `Product: **${doc.name}**`,
    "",
    `This is one system with ${surfaces.length} builds — ${listWords(names)} — in one repository. ${counts.join(", ")}.`,
    "",
    "Build all of them. They are not three projects that happen to share a folder: the clients call the service, the service is the only thing that touches the database, and the whole thing is finished when a journey can be followed end to end through the real API rather than through a mock.",
  ].join("\n")
}

function repository(doc: ProjectDoc, surfaces: Surface[]): string {
  const lines = [
    "Everything lives in one repository, laid out like this:",
    "",
    "```",
    repoTree(doc, doc.name),
    "```",
    "",
  ]
  const rules = [
    "`packages/shared` holds the API contract and nothing else — the request and response types, and the client the apps call. Both clients import it; neither declares its own copy of a payload the service already defines.",
    "No app imports another app. Web and mobile share code through `packages/shared`, never by reaching across `apps/`.",
  ]
  if (surfaces.includes("backend")) {
    rules.push(
      "The service is the only thing that talks to the database. A client with a connection string in it is a bug, not a shortcut.",
      "`docker-compose.yml` starts the database — and anything else the service needs — so a fresh clone can run the tests with one command.",
    )
  }
  rules.push(
    "One lockfile at the root and one command each to install, run and test. Say in the README what those commands are.",
  )
  return lines.concat(rules.map((rule) => `- ${rule}`)).join("\n")
}

/**
 * The boilerplate, reworded for a repository that holds more than one build.
 *
 * The repo is a web app, not a monorepo, so cloning it as the root would put
 * `apps/web`'s files at the top level and leave nowhere for the service. It
 * seeds one folder; the rest is scaffolded around it.
 */
function boilerplate(doc: ProjectDoc, surfaces: Surface[]): string {
  if (doc.startFrom !== "boilerplate") return ""
  if (!surfaces.includes("web")) {
    return "The shared boilerplate is a web app, and this project does not ship one — scaffold each build from scratch, following the structure above."
  }
  return [
    `The web build starts from the shared boilerplate rather than being scaffolded. Clone it into \`${buildFolder.web}\`, drop its history, and build the rest of the repository around it:`,
    "",
    "```bash",
    `git clone --no-checkout ${BOILERPLATE.url}.git ${buildFolder.web}`,
    `cd ${buildFolder.web}`,
    `git checkout ${BOILERPLATE.commit}`,
    "rm -rf .git",
    "```",
    "",
    `Pinned to \`${BOILERPLATE.commit.slice(0, 12)}\` — that commit, not \`main\`, so this brief builds the same thing whenever it is run.`,
    "",
    "It brings the folder structure, TypeScript strict, the design tokens, one http instance with auth and error handling, the three feedback states, and a `CLAUDE.md` carrying the conventions — read it, and do not rebuild any of it. Two adjustments for living in a repository rather than being one:",
    "",
    "- Its `package.json` becomes a workspace member; the lockfile and the shared scripts live at the root.",
    "- Its http instance is replaced by the generated client from `packages/shared` — the contract is the service's, not the boilerplate's placeholder endpoint catalogue.",
    "",
    surfaces.filter((surface) => surface !== "web").length
      ? "The other builds have no boilerplate — scaffold them normally, following the conventions above."
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n")
}

function integration(doc: ProjectDoc, surfaces: Surface[]): string {
  const hasBackend = surfaces.includes("backend")
  const clients = surfaces.filter((surface) => surface !== "backend")
  const stack = doc.surfaces.backend.stack
  const apiStyle = findStackOption("apiStyle", stack.apiStyle)
  const apiAuth = findStackOption("apiAuth", stack.apiAuth)

  if (!hasBackend) {
    return [
      "There is no service in this repository, so both clients talk to the same external API.",
      "",
      "- Declare that API's request and response types once in `packages/shared`, and have both clients import them. Two hand-written copies of the same payload drift the first time the API changes.",
      "- One http client, configured once, shared by both apps: base URL from configuration, auth attached in one place, errors normalised into one shape before any screen sees them.",
    ].join("\n")
  }

  const lines = [
    "The contract is the join. Get it right first, and the rest is wiring.",
    "",
    `1. **Build the service first.** ${
      apiStyle ? apiStyle.promptLine : "Define every endpoint the screens need."
    } Every endpoint the screens below need must exist and answer correctly before a client is pointed at it.`,
    `2. **Publish the contract into \`packages/shared\`.** ${contractLine(stack.apiStyle)} Neither client hand-writes a type the service already knows.`,
    `3. **One generated client, imported by ${listWords(
      clients.map((surface) => surfaceMeta[surface].label.toLowerCase())
    )}.** Base URL comes from configuration — never a literal, and never \`localhost\` in a committed file. ${
      apiAuth ? apiAuth.promptLine : ""
    }`.trim(),
    "4. **Errors cross the boundary once.** The service answers failures in one documented shape; the shared client turns that into one error type; every screen renders that. A screen that parses an error message string is reading something it was never promised.",
    "5. **The clients are not the authority on anything.** Validation, permissions and limits are enforced in the service. The apps mirror them for a better experience, never instead.",
  ]

  if (doc.entities.length) {
    lines.push(
      `6. **The service is the only thing that touches the database.** The ${doc.entities.length} tables in the data model above are owned by it: migrations live in its folder, and no client holds a connection string, a query or an ORM model. A client that reads the database directly is a second source of truth for every rule the service enforces.`
    )
  }

  if (clients.length === 2) {
    lines.push(
      "6. **Web and mobile call the same endpoints.** No mobile-only route that quietly does something different, and no logic living in one client that the other has to reimplement — that belongs in the service or in `packages/shared`.",
    )
  }
  return lines.join("\n")
}

function contractLine(apiStyle: string): string {
  if (apiStyle === "trpc")
    return "With tRPC the router's types are the contract — export them and have the clients infer from them."
  if (apiStyle === "graphql")
    return "Generate typed operations from the GraphQL schema and commit them; the schema is the contract."
  if (apiStyle === "rest-openapi")
    return "Generate the types and the client from the service's own OpenAPI schema — generated from the code, not written alongside it — and commit the generated output so a reviewer can see the contract change in the diff."
  return "Write the request and response types once in `packages/shared`, next to a short note saying which endpoint each belongs to."
}

function integrationTests(doc: ProjectDoc, surfaces: Surface[]): string {
  const hasBackend = surfaces.includes("backend")
  const journeys = doc.flows.slice(0, 4)
  const lines = [
    "Each build having its own passing tests does not mean the system works — that is exactly the state where every part is green and the product is broken. Prove the joins.",
    "",
  ]

  if (hasBackend) {
    lines.push(
      "- **The service, through HTTP.** Every endpoint tested the way a client calls it — status, body, and the failure path — against a real database started by `docker-compose`, not a mocked session.",
      "- **The contract, against the running service.** A test that fails when the service's shape stops matching what `packages/shared` promises. This is the test that catches the change nobody told the clients about.",
    )
  }
  lines.push(
    "- **The journeys, end to end.** For each journey below, one test that follows it through the real stack — the client calling the real service, against a real database — and asserts the acceptance criteria the journey already states. Not a mock in sight.",
  )
  if (journeys.length) {
    lines.push("")
    lines.push("At minimum, these journeys:")
    lines.push("")
    for (const flow of journeys) {
      const criteria = flow.story.criteria.filter(Boolean)
      lines.push(
        `- **${flow.name}** — ${
          criteria.length
            ? `assert: ${criteria.slice(0, 2).map((line) => `“${line}”`).join("; ")}`
            : "assert the journey completes and leaves the data it should behind"
        }`
      )
    }
  }
  lines.push(
    "",
    "- **One command runs all of it** from a clean checkout, and the README says what it is. A test suite that only the person who wrote it can start is not a suite anybody will run.",
    "- **Report what you ran.** When you are finished, say which tests exist, which passed, and what is not covered. Do not claim a journey works because the code looks right.",
  )
  return lines.join("\n")
}

function delivery(
  surfaces: Surface[],
  perSurface: { surface: Surface; built: BuiltPrompt }[]
): string {
  const lines: string[] = []
  for (const { surface, built } of perSurface) {
    const own = built.blocks.find((block) => block.id === "delivery")
    if (!own) continue
    lines.push(`**${surfaceMeta[surface].label}** — \`${buildFolder[surface]}\``)
    lines.push("")
    lines.push(own.body)
    lines.push("")
  }
  lines.push("**The system**")
  lines.push("")
  lines.push(
    [
      "- Every build runs from one clean clone with the documented commands, on a machine that has never seen this project.",
      "- The journeys above pass end to end against the real service.",
      surfaces.includes("backend")
        ? "- The database is created by migrations from empty, and there is seed data enough to demonstrate every screen."
        : "",
      "- No placeholder screens, no TODO comments, no stubbed handler that returns a fixture.",
      "- State any assumption you had to make at the end of your response, in one short list.",
    ]
      .filter(Boolean)
      .join("\n")
  )
  return lines.join("\n")
}

function projectWarnings(doc: ProjectDoc, surfaces: Surface[]): string[] {
  const warnings: string[] = []
  for (const surface of surfaces) {
    const count = doc.screens.filter((screen) => screen.surface === surface).length
    if (count === 0) {
      warnings.push(
        `This project says it ships a ${surfaceMeta[surface].label.toLowerCase()} build, but no screen is tagged \`surface ${surface}\` — that build will have nothing to implement.`
      )
    }
  }
  if (surfaces.includes("backend") && !doc.entities.length) {
    warnings.push(
      "This project ships a service but no tables are drawn on the Data tab, so the prompt cannot say what it stores — the model will invent a schema, and each build will assume a different one."
    )
  }
  if (surfaces.includes("backend") && surfaces.length > 1) {
    const stack = doc.surfaces.backend.stack
    if (!stack.apiStyle) {
      warnings.push(
        "No API style is chosen for the service, so the prompt cannot say how the clients get their types."
      )
    }
    if (stack.apiStyle === "trpc") {
      const clientLanguages = surfaces
        .filter((surface) => surface !== "backend")
        .map((surface) => (surface === "web" ? doc.stack.language : doc.surfaces.mobile.stack.language))
      if (clientLanguages.some((language) => !language.startsWith("ts"))) {
        warnings.push(
          "tRPC hands the clients the server's TypeScript types directly — it cannot work with a client that is not TypeScript."
        )
      }
    }
    if (["fastapi", "django-drf"].includes(stack.framework) && stack.apiStyle === "trpc") {
      warnings.push("tRPC is a TypeScript contract — a Python service cannot expose one.")
    }
  }
  return warnings
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}
