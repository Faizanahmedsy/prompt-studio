import { sectionTypeMap } from "@/features/library/data/section-types"
import type { ProjectDoc } from "@/types/project"

/**
 * Emits canonical `.flow` source for a project document.
 *
 * The parser and this serializer are a matched pair — `parseFlow(serialize(doc))`
 * must return the same document (ids and canvas coordinates aside), which is
 * what keeps the code view a real editing surface rather than a one-way export.
 */
export function serializeFlow(doc: ProjectDoc): string {
  const out: string[] = []

  out.push(`app ${quote(doc.name)} {`)
  out.push(`  target ${doc.target}`)
  out.push(`  creativity ${doc.creativity}`)
  out.push(
    `  theme { primary ${doc.theme.primaryColor}; secondary ${doc.theme.secondaryColor}; radius ${doc.theme.borderRadius}; buttons ${doc.theme.buttonStyle}; density ${doc.theme.density} }`
  )
  out.push("}")

  if (doc.screens.length) {
    out.push("")
    for (const screen of doc.screens) {
      out.push(`screen ${screen.key} ${quote(screen.title)} {`)
      if (screen.template) out.push(`  template ${screen.template}`)
      if (screen.layout) out.push(`  layout ${screen.layout}`)
      if (screen.note.trim()) {
        out.push(`  note ${block(screen.note.trim(), 2)}`)
      }
      out.push("}")
    }
  }

  const byId = new Map(doc.screens.map((s) => [s.id, s]))
  const liveEdges = doc.edges.filter((e) => byId.has(e.from) && byId.has(e.to))
  if (liveEdges.length) {
    out.push("")
    out.push("flow {")
    const width = Math.max(
      ...liveEdges.map((e) => byId.get(e.from)?.key.length ?? 0)
    )
    for (const edge of liveEdges) {
      const from = byId.get(edge.from)!
      const to = byId.get(edge.to)!
      const label = edge.trigger.trim() ? ` : ${quote(edge.trigger.trim())}` : ""
      out.push(`  ${from.key.padEnd(width)} -> ${to.key}${label}`)
    }
    out.push("}")
  }

  if (doc.sections.length) {
    out.push("")
    out.push("landing {")
    for (const section of [...doc.sections].sort((a, b) => a.order - b.order)) {
      const defaultName = sectionTypeMap[section.type]?.name ?? section.type
      const parts = [`  section ${section.type}`]
      parts.push(quote(section.name || defaultName))
      if (section.layout) parts.push(`layout ${section.layout}`)
      if (section.note.trim()) parts.push(`note ${quote(section.note.trim())}`)
      out.push(parts.join(" "))
    }
    out.push("}")
  }

  out.push("")
  out.push("stack {")
  out.push(`  framework      ${doc.stack.framework}`)
  out.push(`  language       ${doc.stack.language}`)
  out.push(`  styling        ${doc.stack.styling}`)
  out.push(`  state          ${doc.stack.state}`)
  out.push(`  forms          ${doc.stack.forms}`)
  out.push(`  http           ${doc.stack.http}`)
  out.push(`  icons          ${doc.stack.icons}`)
  out.push(`  tables         ${doc.stack.tables}`)
  out.push(`  charts         ${doc.stack.charts}`)
  out.push(`  testing        ${doc.stack.testing}`)
  out.push(`  tooling        ${doc.stack.tooling}`)
  out.push(`  packageManager ${doc.stack.packageManager}`)
  if (doc.stack.extras.length) {
    out.push(`  extras ${doc.stack.extras.map((e) => quote(e)).join(" ")}`)
  }
  out.push("}")

  out.push("")
  if (doc.structure.preset === "custom") {
    out.push(`structure custom ${block(doc.structure.customTree, 0)}`)
  } else {
    out.push(`structure ${doc.structure.preset}`)
  }

  if (doc.conventions.ids.length) {
    out.push(`conventions [${doc.conventions.ids.join(", ")}]`)
  }
  if (doc.snippetIds.length) {
    out.push(`snippets [${doc.snippetIds.join(", ")}]`)
  }

  if (doc.conventions.custom.trim()) {
    out.push(`conventions_note ${block(doc.conventions.custom.trim(), 0)}`)
  }

  if (doc.requirements.trim()) {
    out.push("")
    out.push(`requirements ${block(doc.requirements.trim(), 0)}`)
  }

  return `${out.join("\n")}\n`
}

function quote(value: string) {
  return `"${value.replace(/"/g, "'")}"`
}

/** Multi-line values use a heredoc; single-line ones stay quoted. */
function block(value: string, indent: number) {
  if (!value.includes("\n")) return quote(value)
  const pad = " ".repeat(indent)
  const body = value
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n")
  return `"""\n${body}\n${pad}"""`
}
